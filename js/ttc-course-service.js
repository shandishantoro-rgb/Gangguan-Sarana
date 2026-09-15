/* ============================================================
   TTC — Perjalanan KA / Course-Service
   Editor perjalanan individual dan Daftar Waktu per stasiun.
   Modul ini tidak mengganti generator Pola Operasi; KA manual disimpan
   terpisah secara logis melalui atribut sumber dan dipertahankan saat
   generator dijalankan ulang.
   ============================================================ */
(function (global) {
'use strict';

const AUTO_KEY = 'ttc-proyek-otomatis';
const RETURN_KEY = 'ttc-course-return-view';
const SELECTED_KEY = 'ttc-course-selected-ka';
const $ = id => document.getElementById(id);
const esc = v => String(v == null ? '' : v)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
let decorating = false;
let generatorSnapshot = null;

function clone(x) { return JSON.parse(JSON.stringify(x)); }
function uid() { return 'ka-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8); }
function kaKey(k) { return String(k.polaId || '') + '|' + String(k.nomor || ''); }

function bacaProyek() {
  try {
    const raw = localStorage.getItem(AUTO_KEY);
    return raw && global.TTCModel ? TTCModel.migrasi(JSON.parse(raw)) : null;
  } catch (e) { return null; }
}
function normalisasiProyek(p) {
  if (!p.jadwal || !Array.isArray(p.jadwal.ka)) p.jadwal = { ka: [], dibuat: null };
  if (!Array.isArray(p.jadwal.kaNonaktif)) p.jadwal.kaNonaktif = [];
  if (!Array.isArray(p.jadwal.pengecualianGenerator)) p.jadwal.pengecualianGenerator = [];
  const semua = p.jadwal.ka.concat(p.jadwal.kaNonaktif);
  semua.forEach(k => {
    if (!k.id) k.id = uid();
    if (!k.sumber) k.sumber = k.polaId ? 'generator' : 'manual';
    if (k.aktif == null) k.aktif = !p.jadwal.kaNonaktif.includes(k);
    if (!Array.isArray(k.hariOperasi)) k.hariOperasi = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
    (k.perjalanan || []).forEach(t => {
      if (t.datangAktual === undefined) t.datangAktual = null;
      if (t.berangkatAktual === undefined) t.berangkatAktual = null;
      if (t.wt == null) t.wt = 0;
      if (t.jalur == null) t.jalur = 1;
    });
  });
  return p;
}
function tulisProyek(p, selected) {
  try {
    normalisasiProyek(p);
    localStorage.setItem(AUTO_KEY, JSON.stringify(p));
    if (selected) sessionStorage.setItem(SELECTED_KEY, String(selected));
    sessionStorage.setItem(RETURN_KEY, 'jadwal');
    setTimeout(() => location.reload(), 180);
  } catch (e) { alert('Gagal menyimpan perubahan perjalanan KA: ' + e.message); }
}

function parseJam(v) {
  const m = String(v || '').trim().match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = +m[1], mn = +m[2], s = +(m[3] || 0);
  if (mn > 59 || s > 59) return null;
  return h * 3600 + mn * 60 + s;
}
function fmtJam(v, detik) {
  if (v == null || !Number.isFinite(Number(v))) return '';
  let n = Math.round(Number(v));
  const h = Math.floor(n / 3600); n -= h * 3600;
  const m = Math.floor(n / 60), s = n - m * 60;
  const p = x => String(x).padStart(2,'0');
  return p(h) + ':' + p(m) + (detik ? ':' + p(s) : '');
}
function fmtDev(actual, program) {
  if (actual == null || program == null) return '—';
  const d = Math.round((actual - program) / 60);
  return (d >= 0 ? '+' : '−') + Math.abs(d) + "'";
}
function berangkatAwal(k) {
  const a = k && k.perjalanan && k.perjalanan[0];
  return a && a.berangkat != null ? a.berangkat : null;
}

function cariKa(p, idOrNomor) {
  normalisasiProyek(p);
  const all = p.jadwal.ka.concat(p.jadwal.kaNonaktif);
  return all.find(k => k.id === idOrNomor) || all.find(k => String(k.nomor) === String(idOrNomor)) || null;
}
function unikNomor(p, nomor, kecualiId) {
  const all = (p.jadwal.ka || []).concat(p.jadwal.kaNonaktif || []);
  return !all.some(k => String(k.nomor) === String(nomor) && k.id !== kecualiId);
}

function hitungPerjalanan(p, spec, lama) {
  const urutan = TTCModel.lintasan(p, spec.dari, spec.ke);
  if (!urutan || urutan.length < 2) throw new Error('Relasi tidak ditemukan di jaringan.');
  const sarana = TTCModel.cariSarana(p, spec.saranaId);
  if (!sarana) throw new Error('Sarana belum dipilih.');
  const stop = new Set();
  if (spec.berhentiSemua) urutan.forEach(s => stop.add(s.kode));
  else { stop.add(spec.dari); stop.add(spec.ke); }
  if (lama && Array.isArray(lama.perjalanan) && !spec.paksaPolaBaru) {
    lama.perjalanan.forEach(t => { if (t.berhenti) stop.add(t.kode); });
  }
  const wtPersen = Number(p.parameter && p.parameter.wtPersen) || 0;
  const ruas = TTCDinamika.hitungLintasan(p, sarana, urutan, stop, wtPersen);
  const bad = ruas.find(r => r.error); if (bad) throw new Error(bad.error + ' (' + bad.dari + '–' + bad.ke + ')');
  const oldByKode = new Map(((lama && lama.perjalanan) || []).map(t => [t.kode,t]));
  let t = Number(spec.berangkatAwal);
  const dwellDefault = Number(p.parameter && p.parameter.dwellDefault) || 30;
  const perjalanan = [{
    kode:urutan[0].kode,nama:urutan[0].nama,km:Number(urutan[0].km),
    datang:null,berangkat:t,berhenti:true,jalur:(oldByKode.get(urutan[0].kode)||{}).jalur || 1,
    wt:Number((oldByKode.get(urutan[0].kode)||{}).wt)||0,
    datangAktual:(oldByKode.get(urutan[0].kode)||{}).datangAktual ?? null,
    berangkatAktual:(oldByKode.get(urutan[0].kode)||{}).berangkatAktual ?? null
  }];
  for (let i=0;i<ruas.length;i++) {
    const st = urutan[i+1], old = oldByKode.get(st.kode) || {};
    const wtManual = Number(old.wt) || 0;
    t += Number(ruas[i].waktuWT || ruas[i].waktuMurni || 0) + wtManual;
    const akhir = i === ruas.length - 1;
    const berhenti = akhir || stop.has(st.kode);
    let dwell = dwellDefault;
    if (old.datang != null && old.berangkat != null && old.berangkat >= old.datang) dwell = old.berangkat - old.datang;
    perjalanan.push({
      kode:st.kode,nama:st.nama,km:Number(st.km),datang:t,
      berangkat:akhir?null:(berhenti?t+dwell:t),berhenti:berhenti,jalur:old.jalur || 1,wt:wtManual,
      datangAktual:old.datangAktual ?? null,berangkatAktual:old.berangkatAktual ?? null
    });
    if (!akhir && berhenti) t += dwell;
  }
  return perjalanan;
}

function simpanKaDariForm(ev) {
  ev.preventDefault();
  const p = normalisasiProyek(bacaProyek()); if (!p) return;
  const id = $('cs-id').value || null;
  const lama = id ? cariKa(p,id) : null;
  const nomor = $('cs-nomor').value.trim();
  if (!nomor) return alert('Nomor KA wajib diisi.');
  if (!unikNomor(p,nomor,id)) return alert('Nomor KA ' + nomor + ' sudah dipakai.');
  const mulai = parseJam($('cs-mulai').value); if (mulai == null) return alert('Jam keberangkatan tidak valid. Gunakan HH:MM, termasuk 25:14 bila lewat tengah malam.');
  const spec = {
    dari:$('cs-dari').value, ke:$('cs-ke').value, saranaId:$('cs-sarana').value,
    berangkatAwal:mulai, berhentiSemua:$('cs-stop').value==='semua', paksaPolaBaru:!lama
  };
  let perjalanan;
  try {
    const berubahRute = lama && (lama.perjalanan[0].kode !== spec.dari || lama.perjalanan[lama.perjalanan.length-1].kode !== spec.ke || lama.saranaId !== spec.saranaId || berangkatAwal(lama) !== mulai);
    perjalanan = (!lama || berubahRute) ? hitungPerjalanan(p,spec,lama) : clone(lama.perjalanan);
  } catch(e) { return alert(e.message); }
  const arah = $('cs-arah').value;
  const k = lama || {};
  k.id = id || uid(); k.nomor = nomor; k.nama = $('cs-nama').value.trim() || ('KA ' + nomor);
  k.saranaId = spec.saranaId; k.arah = arah; k.relasi = spec.dari + '–' + spec.ke;
  k.sumber = lama ? (lama.sumber || (lama.polaId?'generator':'manual')) : 'manual';
  k.polaId = lama ? (lama.polaId || null) : null;
  k.diubahManual = k.sumber === 'generator' ? true : !!k.diubahManual;
  k.hariOperasi = Array.from(document.querySelectorAll('#cs-hari input:checked')).map(x=>x.value);
  k.aktif = $('cs-aktif').checked; k.perjalanan = perjalanan;
  p.jadwal.ka = p.jadwal.ka.filter(x=>x.id!==k.id);
  p.jadwal.kaNonaktif = p.jadwal.kaNonaktif.filter(x=>x.id!==k.id);
  (k.aktif ? p.jadwal.ka : p.jadwal.kaNonaktif).push(k);
  p.jadwal.ka.sort((a,b)=>(berangkatAwal(a)||0)-(berangkatAwal(b)||0)||String(a.nomor).localeCompare(String(b.nomor)));
  tutupModal(); tulisProyek(p,k.id);
}

function bukaModal(k, mode) {
  const p = normalisasiProyek(bacaProyek()); if (!p) return;
  buatModal();
  const duplicate = mode === 'duplikat';
  const baru = !k || duplicate;
  const src = k ? clone(k) : null;
  $('cs-title').textContent = duplicate ? 'Duplikat KA' : (baru ? 'Tambah KA' : 'Edit KA');
  $('cs-id').value = duplicate ? '' : ((src && src.id) || '');
  $('cs-nomor').value = duplicate ? (String(src.nomor) + 'D') : ((src && src.nomor) || '');
  $('cs-nama').value = (src && src.nama) || '';
  isiSelect($('cs-dari'),p.prasarana.stasiun.map(s=>[s.kode,s.kode+' — '+s.nama]));
  isiSelect($('cs-ke'),p.prasarana.stasiun.map(s=>[s.kode,s.kode+' — '+s.nama]));
  isiSelect($('cs-sarana'),p.sarana.map(s=>[s.id,s.nama]));
  if (src && src.perjalanan && src.perjalanan.length) {
    $('cs-dari').value=src.perjalanan[0].kode; $('cs-ke').value=src.perjalanan[src.perjalanan.length-1].kode;
    $('cs-sarana').value=src.saranaId || ''; $('cs-arah').value=src.arah || 'hilir';
    $('cs-mulai').value=fmtJam(berangkatAwal(src)); $('cs-stop').value=src.perjalanan.slice(1,-1).every(t=>t.berhenti)?'semua':'pilihan';
    $('cs-aktif').checked=duplicate?true:src.aktif!==false;
  } else {
    const st=p.prasarana.stasiun; if(st.length){$('cs-dari').value=st[0].kode;$('cs-ke').value=st[st.length-1].kode;}
    $('cs-arah').value='hilir'; $('cs-mulai').value='05:00'; $('cs-stop').value='semua'; $('cs-aktif').checked=true;
  }
  const hari = new Set((src&&src.hariOperasi)||['Sen','Sel','Rab','Kam','Jum','Sab','Min']);
  document.querySelectorAll('#cs-hari input').forEach(x=>x.checked=hari.has(x.value));
  $('cs-modal').classList.remove('hidden');
}
function isiSelect(sel,rows){ sel.innerHTML=rows.map(r=>'<option value="'+esc(r[0])+'">'+esc(r[1])+'</option>').join(''); }
function tutupModal(){const m=$('cs-modal');if(m)m.classList.add('hidden');}

function buatModal() {
  if ($('cs-modal')) return;
  const d=document.createElement('div'); d.id='cs-modal'; d.className='modal-backdrop hidden';
  d.innerHTML=`<div class="modal wide"><div class="modal-head"><div><span class="eyebrow">PERJALANAN KA</span><h2 id="cs-title">Tambah KA</h2></div><button class="modal-close" id="cs-close">×</button></div>
  <form id="cs-form" class="modal-form">
    <input type="hidden" id="cs-id">
    <label>Nomor KA<input id="cs-nomor" required></label><label>Nama KA<input id="cs-nama" placeholder="Commuter Line Bogor"></label>
    <label>Dari<select id="cs-dari" required></select></label><label>Ke<select id="cs-ke" required></select></label>
    <label>Arah<select id="cs-arah"><option value="hilir">Hilir</option><option value="hulu">Hulu</option></select></label><label>Sarana<select id="cs-sarana" required></select></label>
    <label>Berangkat awal<input id="cs-mulai" placeholder="05:00 / 25:14" required></label><label>Pola berhenti<select id="cs-stop"><option value="semua">Berhenti semua stasiun</option><option value="pilihan">Pertahankan pilihan yang ada / hanya ujung untuk KA baru</option></select></label>
    <div class="full"><div class="sub-head">Hari operasi</div><div id="cs-hari" class="cs-days">${['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(h=>'<label><input type="checkbox" value="'+h+'"> '+h+'</label>').join('')}</div></div>
    <label class="full cs-active"><input id="cs-aktif" type="checkbox" checked> Aktif — hanya KA aktif dipakai GAPEKA, konflik, simulasi, dan ekspor.</label>
    <div class="modal-actions"><button type="button" class="ghost" id="cs-cancel">Batal</button><button type="submit" class="primary-action">Simpan KA</button></div>
  </form></div>`;
  document.body.appendChild(d);
  $('cs-close').onclick=tutupModal; $('cs-cancel').onclick=tutupModal; $('cs-form').onsubmit=simpanKaDariForm;
}

function hapusKa(k) {
  const p=normalisasiProyek(bacaProyek()); if(!p)return;
  const x=cariKa(p,k.id||k.nomor); if(!x)return;
  const dep=fmtJam(berangkatAwal(x));
  if(!confirm('Hapus KA '+x.nomor+' · '+x.relasi+' · berangkat '+dep+'?\nPerjalanan ini akan hilang dari Daftar Waktu, GAPEKA, konflik, simulasi, dan ekspor.'))return;
  if(x.sumber==='generator') {
    const key=kaKey(x); if(!p.jadwal.pengecualianGenerator.includes(key))p.jadwal.pengecualianGenerator.push(key);
  }
  p.jadwal.ka=p.jadwal.ka.filter(a=>a.id!==x.id); p.jadwal.kaNonaktif=p.jadwal.kaNonaktif.filter(a=>a.id!==x.id);
  sessionStorage.removeItem(SELECTED_KEY); tulisProyek(p,null);
}
function setAktif(k,aktif) {
  const p=normalisasiProyek(bacaProyek()); if(!p)return;
  const x=cariKa(p,k.id||k.nomor); if(!x)return;
  p.jadwal.ka=p.jadwal.ka.filter(a=>a.id!==x.id); p.jadwal.kaNonaktif=p.jadwal.kaNonaktif.filter(a=>a.id!==x.id);
  x.aktif=aktif; x.diubahManual=x.sumber==='generator'?true:!!x.diubahManual;
  (aktif?p.jadwal.ka:p.jadwal.kaNonaktif).push(x);
  tulisProyek(p,x.id);
}
function hitungUlang(k) {
  const p=normalisasiProyek(bacaProyek()); if(!p)return;
  const x=cariKa(p,k.id||k.nomor); if(!x)return;
  if(!confirm('Hitung ulang waktu KA '+x.nomor+' mulai dari stasiun awal?\nWT, jalur, dan data realisasi yang sudah diisi akan dipertahankan.'))return;
  const spec={dari:x.perjalanan[0].kode,ke:x.perjalanan[x.perjalanan.length-1].kode,saranaId:x.saranaId,berangkatAwal:berangkatAwal(x),berhentiSemua:false,paksaPolaBaru:false};
  try{x.perjalanan=hitungPerjalanan(p,spec,x);x.diubahManual=x.sumber==='generator'?true:!!x.diubahManual;tulisProyek(p,x.id);}catch(e){alert(e.message);}
}

function renderDwEditor(k) {
  const tb=$('tabel-dw'); if(!tb||!k)return;
  const table=tb.closest('table');
  if(table) table.querySelector('thead').innerHTML='<tr><th>Stasiun</th><th>Prog Dat</th><th>Prog Ber</th><th>Real Dat</th><th>Real Ber</th><th>Dev Dat</th><th>Dev Ber</th><th>Jalur</th><th>Ket.</th><th>WT (dtk)</th></tr>';
  tb.innerHTML=k.perjalanan.map((t,i)=>`<tr data-i="${i}"><td><b>${esc(t.kode)}</b><br><span class="cs-muted">${esc(t.nama)}</span></td>
    <td><input class="cs-time" data-f="datang" value="${esc(fmtJam(t.datang))}" ${i===0?'disabled':''}></td>
    <td><input class="cs-time" data-f="berangkat" value="${esc(fmtJam(t.berangkat))}" ${i===k.perjalanan.length-1?'disabled':''}></td>
    <td><input class="cs-time" data-f="datangAktual" value="${esc(fmtJam(t.datangAktual))}" ${i===0?'disabled':''}></td>
    <td><input class="cs-time" data-f="berangkatAktual" value="${esc(fmtJam(t.berangkatAktual))}" ${i===k.perjalanan.length-1?'disabled':''}></td>
    <td class="num">${fmtDev(t.datangAktual,t.datang)}</td><td class="num">${fmtDev(t.berangkatAktual,t.berangkat)}</td>
    <td><input class="cs-jalur" type="number" min="1" step="1" data-f="jalur" value="${esc(t.jalur||1)}"></td>
    <td><select data-f="berhenti"><option value="1" ${t.berhenti?'selected':''}>Berhenti</option><option value="0" ${!t.berhenti?'selected':''}>Langsung</option></select></td>
    <td><input class="cs-wt" type="number" step="1" data-f="wt" value="${esc(Number(t.wt)||0)}"></td></tr>`).join('');
  const card=tb.closest('.card');
  if(card&&!card.querySelector('.cs-dw-actions')){
    const h=card.querySelector('h2'); const a=document.createElement('span'); a.className='cs-dw-actions';
    a.innerHTML='<button class="small-btn" id="cs-recalc">↻ Hitung Ulang</button><button class="small-btn primary" id="cs-save-dw">Simpan Daftar Waktu</button>'; h.appendChild(a);
  }
  if($('cs-recalc'))$('cs-recalc').onclick=()=>hitungUlang(k);
  if($('cs-save-dw'))$('cs-save-dw').onclick=()=>simpanDaftarWaktu(k.id);
}
function simpanDaftarWaktu(id) {
  const p=normalisasiProyek(bacaProyek()); if(!p)return; const k=cariKa(p,id); if(!k)return;
  const rows=Array.from(document.querySelectorAll('#tabel-dw tr[data-i]'));
  const next=clone(k.perjalanan);
  for(const tr of rows){
    const i=+tr.dataset.i, t=next[i];
    tr.querySelectorAll('[data-f]').forEach(inp=>{
      const f=inp.dataset.f;
      if(f==='datang'||f==='berangkat'||f==='datangAktual'||f==='berangkatAktual') t[f]=inp.disabled?null:(inp.value.trim()===''?null:parseJam(inp.value));
      else if(f==='jalur') t.jalur=Math.max(1,parseInt(inp.value,10)||1);
      else if(f==='wt') t.wt=Number(inp.value)||0;
      else if(f==='berhenti') t.berhenti=inp.value==='1';
    });
    for(const f of ['datang','berangkat','datangAktual','berangkatAktual']){
      const el=tr.querySelector('[data-f="'+f+'"]'); if(el&&!el.disabled&&el.value.trim()!==''&&t[f]==null)return alert('Format waktu tidak valid pada '+t.kode+'. Gunakan HH:MM atau 25:14.');
    }
    if(t.datang!=null&&t.berangkat!=null&&t.berangkat<t.datang)return alert('Berangkat tidak boleh lebih awal dari datang di '+t.kode+'.');
  }
  for(let i=1;i<next.length;i++){
    const prev=next[i-1].berangkat!=null?next[i-1].berangkat:next[i-1].datang;
    const cur=next[i].datang!=null?next[i].datang:next[i].berangkat;
    if(prev!=null&&cur!=null&&cur<prev)return alert('Urutan waktu mundur antara '+next[i-1].kode+' dan '+next[i].kode+'.');
  }
  k.perjalanan=next; k.relasi=next[0].kode+'–'+next[next.length-1].kode; if(k.sumber==='generator')k.diubahManual=true;
  tulisProyek(p,k.id);
}

function decorateRows() {
  if(decorating)return; decorating=true;
  try{
    const p=normalisasiProyek(bacaProyek()); const tb=$('tabel-ka'); if(!p||!tb)return;
    const table=tb.closest('table'), hr=table&&table.querySelector('thead tr');
    if(hr&&!hr.querySelector('.cs-head-source')){hr.insertAdjacentHTML('beforeend','<th class="cs-head-source">Sumber</th><th class="aksi cs-head-action">Aksi</th>');}
    tb.querySelectorAll('tr[data-nomor]').forEach(tr=>{
      if(tr.dataset.courseDecorated)return; const k=cariKa(p,tr.dataset.nomor); if(!k)return;
      tr.dataset.courseDecorated='1'; tr.dataset.kaid=k.id;
      const src=k.sumber==='manual'?'Manual':(k.diubahManual?'Generator · diedit':'Generator');
      tr.insertAdjacentHTML('beforeend','<td><span class="pill">'+esc(src)+'</span></td><td class="aksi cs-actions"><button class="row-action" data-edit>Edit</button><button class="row-action" data-copy>Duplikat</button><button class="row-action" data-off>Nonaktif</button><button class="row-action hapus" data-del>Hapus</button></td>');
      tr.querySelector('[data-edit]').onclick=e=>{e.stopPropagation();bukaModal(k,'edit');};
      tr.querySelector('[data-copy]').onclick=e=>{e.stopPropagation();bukaModal(k,'duplikat');};
      tr.querySelector('[data-off]').onclick=e=>{e.stopPropagation();setAktif(k,false);};
      tr.querySelector('[data-del]').onclick=e=>{e.stopPropagation();hapusKa(k);};
      tr.addEventListener('click',()=>{sessionStorage.setItem(SELECTED_KEY,k.id);setTimeout(()=>renderDwEditor(k),30);});
    });
    const inactive=p.jadwal.kaNonaktif||[];
    inactive.forEach(k=>{
      if(tb.querySelector('tr[data-kaid="'+CSS.escape(k.id)+'"]'))return;
      const a=k.perjalanan[0], z=k.perjalanan[k.perjalanan.length-1];
      const tr=document.createElement('tr');tr.className='cs-inactive';tr.dataset.kaid=k.id;
      tr.innerHTML='<td><b>'+esc(k.nomor)+'</b></td><td><span class="pill '+esc(k.arah)+'">'+esc(k.arah)+'</span></td><td>'+esc(k.relasi)+'</td><td class="num">'+esc(fmtJam(a&&a.berangkat))+'</td><td class="num">'+esc(fmtJam(z&&z.datang))+'</td><td class="num">—</td><td class="num">—</td><td><span class="pill">Nonaktif</span></td><td class="aksi cs-actions"><button class="row-action" data-on>Aktifkan</button><button class="row-action" data-edit>Edit</button><button class="row-action hapus" data-del>Hapus</button></td>';
      tr.querySelector('[data-on]').onclick=e=>{e.stopPropagation();setAktif(k,true);};
      tr.querySelector('[data-edit]').onclick=e=>{e.stopPropagation();bukaModal(k,'edit');};
      tr.querySelector('[data-del]').onclick=e=>{e.stopPropagation();hapusKa(k);};
      tr.onclick=()=>{sessionStorage.setItem(SELECTED_KEY,k.id);renderDwEditor(k);}; tb.appendChild(tr);
    });
    const count=$('count-ka');if(count)count.textContent=(p.jadwal.ka.length+inactive.length)+' ('+inactive.length+' nonaktif)';
  }finally{decorating=false;}
}

function addControls() {
  const head=document.querySelector('#view-jadwal .head-actions');
  if(head&&!$('cs-add')){
    const b=document.createElement('button');b.id='cs-add';b.className='small-btn primary';b.textContent='＋ Tambah KA';b.onclick=()=>bukaModal(null,'baru');head.insertBefore(b,head.firstChild);
  }
  buatModal();
}

function mergeSetelahGenerator() {
  if(!generatorSnapshot)return;
  setTimeout(()=>{
    const old=normalisasiProyek(generatorSnapshot), now=normalisasiProyek(bacaProyek()); generatorSnapshot=null;
    if(!old||!now)return;
    const exclude=new Set(old.jadwal.pengecualianGenerator||[]);
    const inactive=old.jadwal.kaNonaktif||[]; inactive.filter(k=>k.sumber==='generator').forEach(k=>exclude.add(kaKey(k)));
    const protectedGen=(old.jadwal.ka||[]).filter(k=>k.sumber==='generator'&&k.diubahManual);
    const manual=(old.jadwal.ka||[]).filter(k=>k.sumber==='manual');
    let gen=(now.jadwal.ka||[]).map(k=>{k.sumber='generator';k.aktif=true;if(!k.id)k.id=uid();return k;}).filter(k=>!exclude.has(kaKey(k)));
    const byKey=new Map(protectedGen.map(k=>[kaKey(k),k])); gen=gen.map(k=>byKey.get(kaKey(k))||k);
    protectedGen.forEach(k=>{if(!gen.some(x=>kaKey(x)===kaKey(k)))gen.push(k);});
    const manualNums=new Set(manual.map(k=>String(k.nomor))); gen=gen.filter(k=>!manualNums.has(String(k.nomor)));
    now.jadwal.ka=gen.concat(manual); now.jadwal.kaNonaktif=inactive; now.jadwal.pengecualianGenerator=Array.from(exclude);
    now.jadwal.ka.sort((a,b)=>(berangkatAwal(a)||0)-(berangkatAwal(b)||0)||String(a.nomor).localeCompare(String(b.nomor)));
    tulisProyek(now,sessionStorage.getItem(SELECTED_KEY));
  },140);
}

function pasangGeneratorGuard() {
  const b=$('btn-buat-jadwal'); if(!b||b.dataset.courseGuard)return;
  b.dataset.courseGuard='1';
  b.addEventListener('click',()=>{generatorSnapshot=normalisasiProyek(bacaProyek());mergeSetelahGenerator();},true);
}

function injectStyle() {
  if($('cs-style'))return; const s=document.createElement('style');s.id='cs-style';s.textContent=`
  #view-jadwal .split{grid-template-columns:minmax(520px,1.1fr) minmax(640px,1.4fr)}
  #view-jadwal .data-table input,#view-jadwal .data-table select{font:inherit;border:1px solid #d6dde3;border-radius:4px;padding:4px 5px;background:#fff;min-width:72px}
  #view-jadwal .data-table .cs-time{width:76px;font-family:var(--mono)}#view-jadwal .data-table .cs-jalur{width:54px}#view-jadwal .data-table .cs-wt{width:62px}
  .cs-actions{white-space:nowrap;min-width:250px}.cs-dw-actions{float:right;display:inline-flex;gap:6px;margin-left:10px}.cs-muted{font-size:10px;color:var(--ink-3)}
  .cs-inactive{opacity:.58;background:#f4f5f6}.cs-days{display:flex;gap:7px;flex-wrap:wrap;margin-top:7px}.cs-days label{display:inline-flex;flex-direction:row;align-items:center;gap:3px;border:1px solid var(--rule);padding:4px 7px;border-radius:999px}.cs-active{display:flex!important;flex-direction:row!important;align-items:center;gap:8px}
  @media(max-width:1250px){#view-jadwal .split{grid-template-columns:1fr}.cs-actions{min-width:0}}
  `;document.head.appendChild(s);
}

function reopenSelected() {
  if(sessionStorage.getItem(RETURN_KEY)==='jadwal'){
    sessionStorage.removeItem(RETURN_KEY); const nav=document.querySelector('.nav-item[data-view="jadwal"]'); if(nav)setTimeout(()=>nav.click(),30);
  }
  const id=sessionStorage.getItem(SELECTED_KEY); if(!id)return;
  setTimeout(()=>{
    const p=normalisasiProyek(bacaProyek()), k=p&&cariKa(p,id); if(!k)return;
    const tr=document.querySelector('#tabel-ka tr[data-kaid="'+CSS.escape(k.id)+'"]') || document.querySelector('#tabel-ka tr[data-nomor="'+CSS.escape(String(k.nomor))+'"]');
    if(tr){tr.click();renderDwEditor(k);}
  },180);
}

function init() {
  injectStyle(); addControls(); pasangGeneratorGuard(); decorateRows();
  const tb=$('tabel-ka'); if(tb&&global.MutationObserver){new MutationObserver(()=>decorateRows()).observe(tb,{childList:true,subtree:true});}
  reopenSelected();
}

let tries=0;(function wait(){
  const ready=global.TTCModel&&global.TTCJadwal&&global.TTCDinamika&&$('view-jadwal')&&$('btn-buat-jadwal')&&typeof $('btn-buat-jadwal').onclick==='function';
  if(ready){init();return;} if(++tries<200)setTimeout(wait,50);
})();

})(window);
