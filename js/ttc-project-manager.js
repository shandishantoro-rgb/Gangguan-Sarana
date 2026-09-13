/* ============================================================
   TTC — Manajemen Proyek
   Alur: Proyek Saya -> pilih/buat proyek -> workspace TTC.
   Proyek disimpan otomatis di browser melalui TTCProjectStore.
   ============================================================ */
(function (global) {
'use strict';

const AUTO_KEY = 'ttc-proyek-otomatis';
const ACTIVE_KEY = 'ttc-active-project-id-v1';
const MIGRATE_KEY = 'ttc-project-library-migrated-v1';
let activeId = null;
let lastRaw = null;
let syncTimer = null;
let toastTimer = null;

const $ = id => document.getElementById(id);
const esc = v => String(v == null ? '' : v)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

function injectStyle() {
  if ($('ttc-project-manager-style')) return;
  const st = document.createElement('style');
  st.id = 'ttc-project-manager-style';
  st.textContent = `
  html.pm-boot .app-shell{display:none!important}
  #btn-baru,#btn-contoh,label[for="file-buka"]{display:none!important}
  .pm-hidden{display:none!important}
  .pm-library{flex:1;min-height:0;overflow:auto;background:linear-gradient(180deg,#f4f7fa 0%,#edf2f6 100%)}
  .pm-inner{max-width:1180px;margin:0 auto;padding:42px 34px 56px}
  .pm-head{display:flex;gap:28px;align-items:flex-end;justify-content:space-between;margin-bottom:22px}
  .pm-head h1{font-size:34px;margin:4px 0 8px;letter-spacing:-.03em}.pm-head p{margin:0;max-width:720px;color:#6d7d8b;font-size:14px;line-height:1.6}
  .pm-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
  .pm-note{border:1px solid #cbd9e5;background:#f8fbfd;border-radius:10px;padding:12px 14px;color:#4c5b68;font-size:12px;margin-bottom:16px}.pm-note strong{color:#16222d}
  .pm-card{background:#fff;border:1px solid #d6dde3;border-radius:12px;box-shadow:0 6px 24px rgba(31,45,61,.06);overflow:hidden}
  .pm-list-head{display:grid;grid-template-columns:1fr 180px;padding:12px 18px;border-bottom:1px solid #d6dde3;background:#f7f9fb;color:#6d7d8b;font-size:11px;text-transform:uppercase;letter-spacing:.08em}
  .pm-list-head>div{display:flex;gap:10px;align-items:center}.pm-list-head strong{font-size:12px;color:#26333e}.pm-count{text-transform:none;letter-spacing:0;color:#6d7d8b}
  .pm-list{display:flex;flex-direction:column}.pm-row{display:grid;grid-template-columns:minmax(260px,1.7fr) minmax(240px,1fr) 170px auto;gap:18px;align-items:center;padding:15px 18px;border-bottom:1px solid #d6dde3}.pm-row:last-child{border-bottom:0}.pm-row:hover{background:#fbfcfd}
  .pm-main{display:flex;gap:12px;align-items:center;min-width:0}.pm-icon{width:40px;height:40px;border-radius:9px;background:#e8eef5;border:1px solid #d7e1ea;display:flex;align-items:center;justify-content:center;color:#17365f;font-weight:700;flex:none}.pm-main-text{min-width:0}.pm-main strong{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pm-main span{display:block;color:#6d7d8b;font-size:11px;margin-top:3px}
  .pm-stats{display:flex;gap:7px;flex-wrap:wrap}.pm-stat{font-size:10.5px;padding:4px 7px;border:1px solid #d6dde3;border-radius:999px;color:#53616d;background:#fff}.pm-time{font-size:12px;color:#596874}.pm-row-actions{display:flex;gap:6px;justify-content:flex-end}.pm-row-actions button{white-space:nowrap}.pm-danger{color:#a23d32!important}
  .pm-empty{padding:56px 24px;text-align:center;color:#6d7d8b}.pm-empty-icon{font-size:36px;color:#9aabb8;margin-bottom:10px}.pm-empty strong{display:block;color:#26333e;font-size:15px;margin-bottom:6px}.pm-empty span{font-size:12px}
  .pm-autosave{display:flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;border:1px solid #d7e6dc;background:#f4faf6;color:#477256;font-size:10.5px;white-space:nowrap}.pm-dot{width:7px;height:7px;border-radius:50%;background:#3d9a5f}.pm-autosave.saving{border-color:#eadfb8;background:#fffaf0;color:#8a6b13}.pm-autosave.saving .pm-dot{background:#d29d28}.pm-autosave.error{border-color:#ecc7c1;background:#fff5f3;color:#a13e32}.pm-autosave.error .pm-dot{background:#bf4c3c}
  .pm-modal-bg{position:fixed;inset:0;background:rgba(13,24,36,.35);display:flex;align-items:center;justify-content:center;z-index:9999;padding:24px}.pm-modal{width:min(520px,100%);background:#fff;border:1px solid #d6dde3;border-radius:12px;box-shadow:0 20px 60px rgba(20,35,50,.25);overflow:hidden}.pm-modal-head{padding:18px 20px 10px}.pm-modal-head h2{margin:3px 0 0;font-size:20px}.pm-modal-body{padding:10px 20px 20px}.pm-modal-body label{display:block;font-size:12px;font-weight:600;color:#41505d}.pm-modal-body input{margin-top:6px;width:100%;border:1px solid #c8d1d9;border-radius:6px;padding:9px 10px;font:inherit}.pm-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
  .pm-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(12px);background:#15212b;color:#fff;padding:10px 14px;border-radius:7px;font-size:12px;opacity:0;pointer-events:none;transition:.18s;z-index:10000}.pm-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}.pm-toast.error{background:#9f3025}
  @media(max-width:900px){.pm-head{align-items:flex-start;flex-direction:column}.pm-actions{justify-content:flex-start}.pm-row{grid-template-columns:1fr;gap:9px}.pm-list-head{display:none}.pm-row-actions{justify-content:flex-start}.pm-inner{padding:24px 18px}}
  `;
  document.head.appendChild(st);
}

function toast(msg, error) {
  let t = $('pm-toast');
  if (!t) { t = document.createElement('div'); t.id='pm-toast'; t.className='pm-toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.toggle('error', !!error); t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}
function setSaveState(mode, text) {
  const e = $('pm-autosave'); if (!e) return;
  e.classList.remove('saving','error'); if (mode) e.classList.add(mode);
  e.innerHTML = '<span class="pm-dot"></span> ' + esc(text || 'Tersimpan otomatis');
}
function fmt(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('id-ID', {dateStyle:'medium',timeStyle:'short'}); }
  catch(e) { return new Date(iso).toLocaleString('id-ID'); }
}

function buatLibraryDom() {
  if ($('pm-library')) return;
  const app = document.querySelector('.app-window');
  const shell = document.querySelector('.app-shell');
  if (!app || !shell) return;
  const sec = document.createElement('section');
  sec.id = 'pm-library'; sec.className = 'pm-library pm-hidden';
  sec.innerHTML = `
    <div class="pm-inner">
      <div class="pm-head">
        <div><div class="eyebrow">TTC — TRAIN TRAFFIC SIMULATOR</div><h1>Proyek Saya</h1><p>Pilih proyek terlebih dahulu. Setelah proyek dibuka, barulah menu prasarana, sarana, jadwal, GAPEKA, dan simulasi tersedia.</p></div>
        <div class="pm-actions">
          <button class="tool-btn primary" id="pm-new"><span>＋</span> Proyek Baru</button>
          <label class="tool-btn" for="pm-import"><span>⇩</span> Impor JSON</label><input id="pm-import" type="file" accept=".json,application/json" hidden>
          <button class="tool-btn" id="pm-sample"><span>◫</span> Proyek Contoh</button>
        </div>
      </div>
      <div class="pm-note"><strong>Tersimpan di browser ini.</strong> Perubahan proyek disimpan otomatis. Gunakan <b>Simpan JSON</b> di dalam proyek sebagai backup atau untuk pindah perangkat.</div>
      <div class="pm-card">
        <div class="pm-list-head"><div><strong>Daftar Proyek</strong><span class="pm-count" id="pm-count">0 proyek</span></div><span>Terakhir diubah</span></div>
        <div class="pm-list" id="pm-list"></div>
        <div class="pm-empty pm-hidden" id="pm-empty"><div class="pm-empty-icon">▣</div><strong>Belum ada proyek</strong><span>Klik <b>+ Proyek Baru</b> untuk mulai, atau impor file proyek TTC yang sudah ada.</span></div>
      </div>
    </div>`;
  app.insertBefore(sec, shell);
}

function sesuaikanToolbar() {
  const baru=$('btn-baru'), contoh=$('btn-contoh'), simpan=$('btn-simpan');
  if (baru) baru.classList.add('pm-hidden');
  if (contoh) contoh.classList.add('pm-hidden');
  const bukaLabel=document.querySelector('label[for="file-buka"]'); if (bukaLabel) bukaLabel.classList.add('pm-hidden');
  if (simpan) simpan.innerHTML='<span>▣</span> Simpan JSON';
  const grp=simpan && simpan.closest('.toolbar-group');
  if (grp && !$('pm-back')) {
    const b=document.createElement('button'); b.className='tool-btn'; b.id='pm-back'; b.innerHTML='<span>←</span> Proyek Saya';
    grp.insertBefore(b, simpan);
  }
  const toolbar=document.querySelector('.toolbar');
  if (toolbar && !$('pm-autosave')) {
    const chip=document.createElement('div'); chip.id='pm-autosave'; chip.className='pm-autosave'; chip.innerHTML='<span class="pm-dot"></span> Tersimpan otomatis';
    const sep=toolbar.querySelector('.toolbar-separator');
    if (sep) toolbar.insertBefore(chip, sep); else toolbar.appendChild(chip);
  }
}

function showLibrary() {
  const shell=document.querySelector('.app-shell'), lib=$('pm-library');
  if (shell) shell.classList.add('pm-hidden');
  if (lib) lib.classList.remove('pm-hidden');
  document.documentElement.classList.remove('pm-boot');
}
function showWorkspace() {
  const shell=document.querySelector('.app-shell'), lib=$('pm-library');
  if (shell) shell.classList.remove('pm-hidden');
  if (lib) lib.classList.add('pm-hidden');
  document.documentElement.classList.remove('pm-boot');
}

async function renderList() {
  const list=await TTCProjectStore.semua();
  $('pm-count').textContent=list.length+' proyek';
  $('pm-empty').classList.toggle('pm-hidden',list.length>0);
  $('pm-list').innerHTML=list.map(p=>`
    <div class="pm-row" data-id="${esc(p.id)}">
      <div class="pm-main"><div class="pm-icon">TTC</div><div class="pm-main-text"><strong>${esc(p.nama)}</strong><span>Dibuat ${esc(fmt(p.dibuat))}</span></div></div>
      <div class="pm-stats"><span class="pm-stat">${p.stasiun} stasiun</span><span class="pm-stat">${p.petak} petak</span><span class="pm-stat">${p.sarana} sarana</span><span class="pm-stat">${p.ka} KA</span></div>
      <div class="pm-time">${esc(fmt(p.diubah))}</div>
      <div class="pm-row-actions"><button class="small-btn" data-open="${esc(p.id)}">Buka</button><button class="small-btn" data-copy="${esc(p.id)}">Duplikat</button><button class="small-btn pm-danger" data-delete="${esc(p.id)}">Hapus</button></div>
    </div>`).join('');
}

function getAutoData() {
  try { const raw=localStorage.getItem(AUTO_KEY); return raw ? {raw, data:TTCModel.migrasi(JSON.parse(raw))} : null; }
  catch(e) { return null; }
}
async function syncActive(force) {
  if (!activeId) return;
  const x=getAutoData(); if (!x) return;
  if (!force && x.raw===lastRaw) return;
  setSaveState('saving','Menyimpan…');
  try { await TTCProjectStore.simpan(activeId,x.data); lastRaw=x.raw; setSaveState('','Tersimpan otomatis'); }
  catch(e){ setSaveState('error','Gagal menyimpan'); console.error('TTC Project autosave',e); }
}
function startSync() {
  clearInterval(syncTimer);
  syncTimer=setInterval(()=>syncActive(false),450);
  setTimeout(()=>syncActive(true),250);
}
function stopSync(){clearInterval(syncTimer);syncTimer=null;}

async function openProject(id) {
  const data=await TTCProjectStore.ambil(id); if(!data){toast('Proyek tidak ditemukan.',true);return;}
  try { localStorage.setItem(AUTO_KEY,JSON.stringify(data)); sessionStorage.setItem(ACTIVE_KEY,id); }
  catch(e){toast('Browser tidak mengizinkan penyimpanan lokal.',true);return;}
  location.reload();
}
async function createProject(name,sample) {
  const p=sample?TTCModel.contohProyek():TTCModel.proyekKosong();
  if(!sample) p.sarana=TTCModel.saranaBawaan();
  if(name) p.namaProyek=name.trim();
  p.dibuat=new Date().toISOString();
  const id=await TTCProjectStore.buat(p); await openProject(id);
}
async function importProject(file) {
  if(!file)return;
  try{const data=TTCModel.migrasi(JSON.parse(await file.text()));const id=await TTCProjectStore.buat(data);await openProject(id);}
  catch(e){toast('Gagal mengimpor proyek: '+e.message,true);}
}

function newProjectDialog() {
  if($('pm-new-modal')) return;
  const bg=document.createElement('div'); bg.id='pm-new-modal'; bg.className='pm-modal-bg';
  bg.innerHTML=`<div class="pm-modal"><div class="pm-modal-head"><div class="eyebrow">PROYEK</div><h2>Proyek Baru</h2></div><form id="pm-new-form" class="pm-modal-body"><label>Nama proyek<input id="pm-new-name" maxlength="80" placeholder="Contoh: Gapeka Bogor 2026" required></label><div class="pm-modal-actions"><button type="button" class="tool-btn" id="pm-cancel">Batal</button><button type="submit" class="tool-btn primary">Buat & Buka Proyek</button></div></form></div>`;
  document.body.appendChild(bg);
  $('pm-cancel').onclick=()=>bg.remove();
  bg.onclick=e=>{if(e.target===bg)bg.remove();};
  $('pm-new-form').onsubmit=async e=>{e.preventDefault();const n=$('pm-new-name').value.trim();if(!n)return;await createProject(n,false);};
  setTimeout(()=>$('pm-new-name').focus(),0);
}

async function migrateLegacyIfNeeded() {
  try {
    if(localStorage.getItem(MIGRATE_KEY)) return;
    if(!global.__TTC_HAD_LEGACY_AUTO__) { localStorage.setItem(MIGRATE_KEY,'1'); return; }
    const all=await TTCProjectStore.semua();
    const x=getAutoData();
    if(!all.length && x) await TTCProjectStore.migrasiLegacy(x.data);
    localStorage.setItem(MIGRATE_KEY,'1');
  } catch(e){}
}

function bind() {
  $('pm-new').onclick=newProjectDialog;
  $('pm-sample').onclick=()=>createProject('',true);
  $('pm-import').onchange=e=>{const f=e.target.files&&e.target.files[0];e.target.value='';importProject(f);};
  $('pm-list').onclick=async e=>{
    const o=e.target.closest('[data-open]'); if(o)return openProject(o.dataset.open);
    const c=e.target.closest('[data-copy]'); if(c){await TTCProjectStore.duplikat(c.dataset.copy);await renderList();toast('Proyek diduplikat.');return;}
    const d=e.target.closest('[data-delete]'); if(d){const row=d.closest('.pm-row');const name=row?row.querySelector('.pm-main strong').textContent:'proyek ini';if(!confirm('Hapus "'+name+'" dari browser ini?'))return;await TTCProjectStore.hapus(d.dataset.delete);await renderList();toast('Proyek dihapus.');}
  };
  const back=$('pm-back'); if(back) back.onclick=async()=>{await syncActive(true);stopSync();activeId=null;try{sessionStorage.removeItem(ACTIVE_KEY);}catch(e){}showLibrary();await renderList();};
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')syncActive(true);});
  global.addEventListener('beforeunload',()=>{syncActive(true);});
}

async function start() {
  injectStyle(); buatLibraryDom(); sesuaikanToolbar();
  await TTCProjectStore.init(); await migrateLegacyIfNeeded();
  try{activeId=sessionStorage.getItem(ACTIVE_KEY);}catch(e){activeId=null;}
  bind();
  if(activeId){showWorkspace();startSync();}
  else{showLibrary();await renderList();}
}

injectStyle();
if(document.readyState==='complete') setTimeout(start,0);
else global.addEventListener('load',()=>setTimeout(start,0),{once:true});
})(window);
