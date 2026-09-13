/* ============================================================
   TTC — Antarmuka
   Menghubungkan seluruh modul dengan tampilan.
   ============================================================ */
(function () {
'use strict';

const $  = id => document.getElementById(id);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const esc = v => String(v == null ? '' : v)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const num = (v, d) => Number.isFinite(Number(v)) ? Number(v).toFixed(d == null ? 1 : d) : '—';
const jam = TTCJadwal.detikKeJam;

/* ---------- keadaan ---------- */
let proyek = TTCModel.proyekKosong();
let konflik = [];
let kaTerpilih = null;
let petakTerpilih = null;
let tabelBlok = [];
let sinyalTerpilih = null;
let empKode = null;
let simop = null;
const ss = { jalan: false, kecepatan: 30, terakhir: 0, raf: 0, dt: 1 };
let toastTimer = null;
const sim = { jalan: false, t: 4 * 3600, kecepatan: 60, terakhir: 0, raf: 0 };

const KUNCI_SIMPAN = 'ttc-proyek-otomatis';

/* ---------- pemberitahuan ---------- */
function toast(pesan, error) {
  const t = $('toast');
  t.textContent = pesan;
  t.classList.toggle('error', !!error);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}
function status(pesan) { $('status-text').innerHTML = '<span class="status-dot"></span> ' + esc(pesan); }
function peringatan(pesan) {
  const b = $('validation-banner');
  if (!pesan) { b.classList.add('hidden'); b.textContent = ''; return; }
  b.textContent = pesan; b.classList.remove('hidden'); toast(pesan, true);
}

/* ---------- simpan otomatis ---------- */
function simpanOtomatis() {
  try { localStorage.setItem(KUNCI_SIMPAN, JSON.stringify(proyek)); } catch (e) {}
}
function muatOtomatis() {
  try {
    const s = localStorage.getItem(KUNCI_SIMPAN);
    if (!s) return false;
    proyek = TTCModel.migrasi(JSON.parse(s));
    return true;
  } catch (e) { return false; }
}

/* ============================================================
   NAVIGASI
   ============================================================ */
function pindahView(nama) {
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + nama));
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === nama));
  if (nama === 'peta') gambarPeta();
  if (nama === 'gapeka') gambarGapeka();
  if (nama === 'simulasi') siapkanSimulasi();
  if (nama === 'blok') renderBlok();
  if (nama === 'sinyal') renderSinyal();
  if (nama === 'emplasemen') renderEmplasemen();
  if (nama === 'simsinyal') siapkanSimSinyal();
  $('content').scrollTop = 0;
}

/* ============================================================
   RENDER UMUM
   ============================================================ */
function renderSemua() {
  TTCModel.urutkanStasiun(proyek);
  renderHitungan();
  renderBeranda();
  renderStasiun();
  renderPetak();
  renderSarana();
  renderPola();
  renderEmplasemen();
  renderSinyal();
  renderBlok();
  renderJadwal();
  renderKonflik();
  renderParameter();
  isiSemuaPilihan();
  const aktif = document.querySelector('.view.active');
  if (aktif && aktif.id === 'view-peta') gambarPeta();
  if (aktif && aktif.id === 'view-gapeka') gambarGapeka();
  simpanOtomatis();
}

function renderHitungan() {
  const s = proyek.prasarana.stasiun.length;
  const p = proyek.prasarana.petakJalan.length;
  const sr = proyek.sarana.length;
  const po = proyek.polaOperasi.length;
  const ka = proyek.jadwal.ka.length;
  $('nav-jml-stasiun').textContent = s;
  $('nav-jml-petak').textContent = p;
  $('nav-jml-sinyal').textContent = TTCSinyal.semua(proyek).length;
  $('nav-jml-emplasemen').textContent = proyek.prasarana.stasiun.filter(x => x.layout).length;
  $('nav-jml-blok').textContent = proyek.prasarana.petakJalan.filter(x => TTCModel.jumlahBlok(x, 'hilir') > 0).length;
  $('nav-jml-sarana').textContent = sr;
  $('nav-jml-pola').textContent = po;
  $('nav-jml-ka').textContent = ka;
  const nk = $('nav-jml-konflik');
  nk.textContent = konflik.length;
  nk.dataset.ada = konflik.length ? '1' : '0';
  $('status-counts').textContent = s + ' stasiun · ' + p + ' petak · ' + ka + ' KA';
  $('toolbar-nama-proyek').textContent = proyek.namaProyek || 'Proyek TTC';
}

function panjangLintas() {
  const st = proyek.prasarana.stasiun;
  if (st.length < 2) return 0;
  return Math.max(...st.map(x => Number(x.km))) - Math.min(...st.map(x => Number(x.km)));
}

function renderBeranda() {
  $('kpi-stasiun').textContent = proyek.prasarana.stasiun.length;
  $('kpi-petak').textContent = proyek.prasarana.petakJalan.length;
  $('kpi-panjang').textContent = num(panjangLintas(), 1);
  $('kpi-sarana').textContent = proyek.sarana.length;
  $('kpi-ka').textContent = proyek.jadwal.ka.length;
  $('kpi-konflik').textContent = konflik.length;
  $('kpi-konflik').parentElement.dataset.aman = (proyek.jadwal.ka.length && !konflik.length) ? '1' : '0';
  $('nama-proyek').value = proyek.namaProyek || '';
  $('info-dibuat').textContent = proyek.dibuat ? new Date(proyek.dibuat).toLocaleString('id-ID') : '—';

  const langkah = [
    ['Data stasiun',      proyek.prasarana.stasiun.length >= 2, 'stasiun'],
    ['Petak jalan',       proyek.prasarana.petakJalan.length >= 1, 'petak'],
    ['Data sarana',       proyek.sarana.length >= 1, 'sarana'],
    ['Pola operasi',      proyek.polaOperasi.length >= 1, 'pola'],
    ['Jadwal dibangkitkan', proyek.jadwal.ka.length >= 1, 'jadwal'],
    ['Konflik diperiksa', !!proyek.jadwal.ka.length && konflik !== null && proyek.jadwal.dibuat, 'konflik'],
    ['GAPEKA tergambar',  proyek.jadwal.ka.length >= 1, 'gapeka']
  ];
  $('langkah-list').innerHTML = langkah.map(([nama, ok, view]) =>
    '<li class="' + (ok ? 'selesai' : '') + '"><span>' + esc(nama) + '</span>' +
    '<button class="row-action" data-goto="' + view + '">Buka</button></li>').join('');
  $$('#langkah-list [data-goto]').forEach(b => b.onclick = () => pindahView(b.dataset.goto));
}

/* ============================================================
   PRASARANA — STASIUN
   ============================================================ */
function renderStasiun() {
  const tb = $('tabel-stasiun');
  const st = proyek.prasarana.stasiun;
  $('empty-stasiun').classList.toggle('hidden', st.length > 0);
  tb.innerHTML = st.map((s, i) =>
    '<tr><td><b>' + esc(s.kode) + '</b></td><td>' + esc(s.nama) + '</td>' +
    '<td class="num">' + num(s.km, 3) + '</td><td class="num">' + esc(s.jumlahJalur) + '</td>' +
    '<td>' + esc(s.jenis) + '</td>' +
    '<td class="aksi"><button class="row-action" data-ubah="' + i + '">Ubah</button>' +
    '<button class="row-action hapus" data-hapus="' + i + '">Hapus</button></td></tr>').join('');
  tb.querySelectorAll('[data-ubah]').forEach(b => b.onclick = () => bukaModalStasiun(+b.dataset.ubah));
  tb.querySelectorAll('[data-hapus]').forEach(b => b.onclick = () => hapusStasiun(+b.dataset.hapus));
}

function bukaModalStasiun(idx) {
  const baru = (idx == null);
  const s = baru ? { kode: '', nama: '', km: '', jumlahJalur: 2, jenis: 'Stasiun' } : proyek.prasarana.stasiun[idx];
  $('ms-judul').textContent = baru ? 'Tambah Stasiun' : 'Ubah Stasiun';
  $('st-asal').value = baru ? '' : String(idx);
  $('st-kode').value = s.kode; $('st-nama').value = s.nama;
  $('st-km').value = s.km; $('st-jalur').value = s.jumlahJalur; $('st-jenis').value = s.jenis;
  buka('modal-stasiun');
}

function simpanStasiun(e) {
  e.preventDefault();
  const idx = $('st-asal').value === '' ? null : +$('st-asal').value;
  const data = {
    kode: $('st-kode').value.trim().toUpperCase(),
    nama: $('st-nama').value.trim(),
    km: Number($('st-km').value),
    jumlahJalur: parseInt($('st-jalur').value, 10),
    jenis: $('st-jenis').value
  };
  if (!data.kode || !data.nama) return peringatan('Kode dan nama stasiun wajib diisi.');
  if (!Number.isFinite(data.km) || data.km < 0) return peringatan('Km harus angka dan tidak boleh negatif.');
  if (!Number.isInteger(data.jumlahJalur) || data.jumlahJalur < 1) return peringatan('Jumlah jalur minimal 1.');
  const kembar = proyek.prasarana.stasiun.some((x, i) => x.kode === data.kode && i !== idx);
  if (kembar) return peringatan('Kode stasiun ' + data.kode + ' sudah dipakai.');

  if (idx == null) proyek.prasarana.stasiun.push(data);
  else proyek.prasarana.stasiun[idx] = data;
  peringatan(''); tutup('modal-stasiun'); renderSemua();
  toast(idx == null ? 'Stasiun ditambahkan.' : 'Stasiun diperbarui.');
}

function hapusStasiun(i) {
  const s = proyek.prasarana.stasiun[i];
  if (!confirm('Hapus stasiun ' + s.kode + ' — ' + s.nama + '?\nPetak jalan yang memakainya ikut terhapus.')) return;
  proyek.prasarana.stasiun.splice(i, 1);
  proyek.prasarana.petakJalan = proyek.prasarana.petakJalan.filter(p => p.dari !== s.kode && p.ke !== s.kode);
  renderSemua(); toast('Stasiun dihapus.');
}

/* ============================================================
   PRASARANA — PETAK JALAN
   ============================================================ */
function renderPetak() {
  const tb = $('tabel-petak');
  const pj = proyek.prasarana.petakJalan;
  $('empty-petak').classList.toggle('hidden', pj.length > 0);
  tb.innerHTML = pj.map((p, i) =>
    '<tr><td><b>' + esc(p.dari) + '</b></td><td><b>' + esc(p.ke) + '</b></td>' +
    '<td class="num">' + num(p.jarak, 3) + '</td>' +
    '<td><span class="pill' + (p.jenisJalur === 'Tunggal' ? ' tunggal' : '') + '">' + esc(p.jenisJalur) + '</span></td>' +
    '<td class="num">' + esc(p.kecepatanMaks) + '</td>' +
    '<td class="num">' + num(p.gradien, 1) + '</td>' +
    '<td class="num">' + (Number(p.radius) > 0 ? num(p.radius, 0) : '—') + '</td>' +
    '<td class="aksi"><button class="row-action" data-ubah="' + i + '">Ubah</button>' +
    '<button class="row-action hapus" data-hapus="' + i + '">Hapus</button></td></tr>').join('');
  tb.querySelectorAll('[data-ubah]').forEach(b => b.onclick = () => bukaModalPetak(+b.dataset.ubah));
  tb.querySelectorAll('[data-hapus]').forEach(b => b.onclick = () => {
    proyek.prasarana.petakJalan.splice(+b.dataset.hapus, 1); renderSemua(); toast('Petak jalan dihapus.');
  });
}

function bukaModalPetak(idx) {
  const baru = (idx == null);
  const p = baru ? { dari: '', ke: '', jarak: '', jenisJalur: 'Ganda', kecepatanMaks: 70, gradien: 0, radius: 0 }
                 : proyek.prasarana.petakJalan[idx];
  $('mp-judul').textContent = baru ? 'Tambah Petak Jalan' : 'Ubah Petak Jalan';
  $('pt-index').value = baru ? '' : String(idx);
  isiPilihanStasiun($('pt-dari')); isiPilihanStasiun($('pt-ke'));
  $('pt-dari').value = p.dari; $('pt-ke').value = p.ke;
  $('pt-jarak').value = p.jarak; $('pt-jenis').value = p.jenisJalur;
  $('pt-vmax').value = p.kecepatanMaks; $('pt-gradien').value = p.gradien || 0; $('pt-radius').value = p.radius || 0;
  buka('modal-petak');
}

function simpanPetak(e) {
  e.preventDefault();
  const idx = $('pt-index').value === '' ? null : +$('pt-index').value;
  const d = {
    dari: $('pt-dari').value, ke: $('pt-ke').value,
    jarak: Number($('pt-jarak').value), jenisJalur: $('pt-jenis').value,
    kecepatanMaks: Number($('pt-vmax').value),
    gradien: Number($('pt-gradien').value) || 0,
    radius: Number($('pt-radius').value) || 0,
    headwayMin: 0
  };
  if (!d.dari || !d.ke) return peringatan('Stasiun asal dan tujuan wajib dipilih.');
  if (d.dari === d.ke) return peringatan('Petak jalan harus menghubungkan dua stasiun berbeda.');
  if (!(d.jarak > 0)) return peringatan('Jarak harus lebih dari 0 km.');
  if (!(d.kecepatanMaks > 0)) return peringatan('Kecepatan maksimum harus lebih dari 0.');
  const kembar = proyek.prasarana.petakJalan.some((x, i) => i !== idx &&
    ((x.dari === d.dari && x.ke === d.ke) || (x.dari === d.ke && x.ke === d.dari)));
  if (kembar) return peringatan('Petak ' + d.dari + '–' + d.ke + ' sudah ada.');

  if (idx == null) proyek.prasarana.petakJalan.push(d); else proyek.prasarana.petakJalan[idx] = d;
  peringatan(''); tutup('modal-petak'); renderSemua(); toast('Petak jalan disimpan.');
}

function petakOtomatis() {
  TTCModel.urutkanStasiun(proyek);
  const st = proyek.prasarana.stasiun;
  if (st.length < 2) return peringatan('Perlu minimal dua stasiun.');
  let tambah = 0;
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i], b = st[i + 1];
    if (TTCModel.cariPetak(proyek, a.kode, b.kode)) continue;
    proyek.prasarana.petakJalan.push({
      dari: a.kode, ke: b.kode,
      jarak: +(Number(b.km) - Number(a.km)).toFixed(3),
      jenisJalur: 'Ganda', kecepatanMaks: 70, gradien: 0, radius: 0, headwayMin: 0
    });
    tambah++;
  }
  renderSemua();
  toast(tambah ? tambah + ' petak jalan dibuat dari urutan km.' : 'Semua petak sudah lengkap.');
}

/* ============================================================
   SARANA
   ============================================================ */
function renderSarana() {
  const tb = $('tabel-sarana');
  $('empty-sarana').classList.toggle('hidden', proyek.sarana.length > 0);
  tb.innerHTML = proyek.sarana.map((s, i) =>
    '<tr><td><b>' + esc(s.nama) + '</b></td><td>' + esc(s.jenis) + '</td>' +
    '<td class="num">' + esc(s.jumlahKereta) + '</td>' +
    '<td class="num">' + num(TTCDinamika.massaDinas(s, 1), 0) + ' t</td>' +
    '<td class="num">' + esc(s.dayaKontinu) + ' kW</td>' +
    '<td class="num">' + num(s.percepatan, 2) + '</td>' +
    '<td class="num">' + num(s.perlambatanDinas, 2) + '</td>' +
    '<td class="num">' + esc(s.kecepatanMaks) + '</td>' +
    '<td class="aksi"><button class="row-action" data-ubah="' + i + '">Ubah</button>' +
    '<button class="row-action hapus" data-hapus="' + i + '">Hapus</button></td></tr>').join('');
  tb.querySelectorAll('[data-ubah]').forEach(b => b.onclick = () => bukaModalSarana(+b.dataset.ubah));
  tb.querySelectorAll('[data-hapus]').forEach(b => b.onclick = () => {
    proyek.sarana.splice(+b.dataset.hapus, 1); renderSemua(); toast('Sarana dihapus.');
  });
}

function bukaModalSarana(idx) {
  const baru = (idx == null);
  const s = baru ? { nama: '', jenis: 'KRL', jumlahKereta: 12, massaKosong: 350, massaPenumpang: 120,
                     dayaKontinu: 4000, percepatan: .85, perlambatanDinas: .95, kecepatanMaks: 90,
                     panjang: 240, davisA: 15.5, davisB: .31, davisC: .0062 }
                 : proyek.sarana[idx];
  $('msr-judul').textContent = baru ? 'Tambah Sarana' : 'Ubah Sarana';
  $('sr-asal').value = baru ? '' : String(idx);
  $('sr-nama').value = s.nama; $('sr-jenis').value = s.jenis; $('sr-jml').value = s.jumlahKereta;
  $('sr-massa').value = s.massaKosong; $('sr-muatan').value = s.massaPenumpang;
  $('sr-daya').value = s.dayaKontinu; $('sr-acc').value = s.percepatan; $('sr-dec').value = s.perlambatanDinas;
  $('sr-vmax').value = s.kecepatanMaks; $('sr-panjang').value = s.panjang || 200;
  $('sr-da').value = s.davisA; $('sr-db').value = s.davisB; $('sr-dc').value = s.davisC;
  buka('modal-sarana');
}

function simpanSarana(e) {
  e.preventDefault();
  const idx = $('sr-asal').value === '' ? null : +$('sr-asal').value;
  const d = {
    id: idx == null ? 'sr-' + Date.now().toString(36) : proyek.sarana[idx].id,
    nama: $('sr-nama').value.trim(), jenis: $('sr-jenis').value,
    jumlahKereta: parseInt($('sr-jml').value, 10),
    massaKosong: Number($('sr-massa').value), massaPenumpang: Number($('sr-muatan').value) || 0,
    dayaKontinu: Number($('sr-daya').value),
    percepatan: Number($('sr-acc').value), perlambatanDinas: Number($('sr-dec').value),
    kecepatanMaks: Number($('sr-vmax').value), panjang: Number($('sr-panjang').value) || 200,
    davisA: Number($('sr-da').value), davisB: Number($('sr-db').value), davisC: Number($('sr-dc').value)
  };
  if (!d.nama) return peringatan('Nama sarana wajib diisi.');
  if (!(d.massaKosong > 0)) return peringatan('Massa kosong harus lebih dari 0 ton.');
  if (!(d.percepatan > 0) || !(d.perlambatanDinas > 0)) return peringatan('Percepatan dan perlambatan harus lebih dari 0.');
  if (!(d.kecepatanMaks > 0)) return peringatan('Kecepatan maksimum harus lebih dari 0.');
  if (idx == null) proyek.sarana.push(d); else proyek.sarana[idx] = d;
  peringatan(''); tutup('modal-sarana'); renderSemua(); toast('Sarana disimpan.');
}

/* ---------- uji cepat waktu tempuh ---------- */
function ujiHitung() {
  const s = TTCModel.cariSarana(proyek, $('uji-sarana').value);
  const a = $('uji-dari').value, b = $('uji-ke').value;
  if (!s) return peringatan('Pilih sarana dulu.');
  if (!a || !b || a === b) return peringatan('Pilih dua stasiun berbeda.');
  const petak = TTCModel.cariPetak(proyek, a, b);
  if (!petak) return peringatan('Belum ada petak jalan antara ' + a + ' dan ' + b + '.');
  const vLewat = Math.min(Number(petak.kecepatanMaks), Number(s.kecepatanMaks));
  const r = TTCDinamika.waktuPetak(proyek, s, a, b, {
    vAwal: $('uji-vawal').value === '1' ? vLewat : 0,
    vAkhir: $('uji-vakhir').value === '1' ? vLewat : 0
  });
  peringatan('');
  const wt = Number(proyek.parameter.wtPersen) || 0;
  $('uji-hasil').innerHTML =
    '<div class="grid">' +
    kotak('Waktu murni', (r.waktu / 60).toFixed(2) + ' mnt') +
    kotak('Dengan WT ' + wt + '%', (r.waktu * (1 + wt / 100) / 60).toFixed(2) + ' mnt') +
    kotak('Jarak', num(petak.jarak, 3) + ' km') +
    kotak('V puncak', num(r.vMaks, 1) + ' km/j') +
    kotak('V rata-rata', num(r.vRata, 1) + ' km/j') +
    '</div>';
}
const kotak = (l, v) => '<div class="box"><span>' + esc(l) + '</span><strong>' + esc(v) + '</strong></div>';

/* ============================================================
   POLA OPERASI
   ============================================================ */
function renderPola() {
  const tb = $('tabel-pola');
  $('empty-pola').classList.toggle('hidden', proyek.polaOperasi.length > 0);
  tb.innerHTML = proyek.polaOperasi.map((p, i) => {
    const sr = TTCModel.cariSarana(proyek, p.saranaId);
    return '<tr><td><b>' + esc(p.nama) + '</b></td>' +
      '<td>' + esc(sr ? sr.nama : '—') + '</td>' +
      '<td>' + esc(p.dari) + '–' + esc(p.ke) + (p.duaArah ? ' pp' : '') + '</td>' +
      '<td class="num">' + esc(p.jamMulai) + '–' + esc(p.jamAkhir) + '</td>' +
      '<td class="num">' + esc(p.headway) + ' mnt</td>' +
      '<td>' + (p.berhentiSemua ? 'Semua stasiun' : (p.berhentiDi || []).length + ' stasiun') + '</td>' +
      '<td class="num">' + esc(p.nomorAwal) + '+' + esc(p.langkahNomor) + '</td>' +
      '<td class="aksi"><button class="row-action" data-ubah="' + i + '">Ubah</button>' +
      '<button class="row-action hapus" data-hapus="' + i + '">Hapus</button></td></tr>';
  }).join('');
  tb.querySelectorAll('[data-ubah]').forEach(b => b.onclick = () => bukaModalPola(+b.dataset.ubah));
  tb.querySelectorAll('[data-hapus]').forEach(b => b.onclick = () => {
    proyek.polaOperasi.splice(+b.dataset.hapus, 1); renderSemua(); toast('Pola operasi dihapus.');
  });
}

function bukaModalPola(idx) {
  const baru = (idx == null);
  const st = proyek.prasarana.stasiun;
  if (st.length < 2) return peringatan('Isi data stasiun dulu.');
  if (!proyek.sarana.length) return peringatan('Isi data sarana dulu.');
  const p = baru ? {
    nama: '', saranaId: proyek.sarana[0].id, dari: st[0].kode, ke: st[st.length - 1].kode,
    duaArah: true, jamMulai: '05:00', jamAkhir: '22:00', headway: 10,
    nomorAwal: 1000, langkahNomor: 2, berhentiSemua: true, berhentiDi: [], dwell: 30
  } : proyek.polaOperasi[idx];

  $('mpo-judul').textContent = baru ? 'Tambah Pola Operasi' : 'Ubah Pola Operasi';
  $('po-asal').value = baru ? '' : String(idx);
  $('po-sarana').innerHTML = proyek.sarana.map(s => '<option value="' + esc(s.id) + '">' + esc(s.nama) + '</option>').join('');
  isiPilihanStasiun($('po-dari')); isiPilihanStasiun($('po-ke'));
  $('po-nama').value = p.nama; $('po-sarana').value = p.saranaId;
  $('po-dari').value = p.dari; $('po-ke').value = p.ke;
  $('po-duaarah').value = p.duaArah ? '1' : '0';
  $('po-mulai').value = p.jamMulai; $('po-akhir').value = p.jamAkhir;
  $('po-headway').value = p.headway; $('po-dwell').value = p.dwell || 30;
  $('po-nomor').value = p.nomorAwal; $('po-langkah').value = p.langkahNomor;
  $('po-berhenti-semua').value = p.berhentiSemua ? '1' : '0';
  isiChipStasiun(p.berhentiDi || []);
  $('po-pilih-wrap').classList.toggle('hidden', !!p.berhentiSemua);
  buka('modal-pola');
}

function isiChipStasiun(terpilih) {
  const set = new Set(terpilih);
  $('po-pilih').innerHTML = proyek.prasarana.stasiun.map(s =>
    '<label class="' + (set.has(s.kode) ? 'on' : '') + '"><input type="checkbox" value="' + esc(s.kode) + '"' +
    (set.has(s.kode) ? ' checked' : '') + '>' + esc(s.kode) + '</label>').join('');
  $('po-pilih').querySelectorAll('input').forEach(cb =>
    cb.onchange = () => cb.parentElement.classList.toggle('on', cb.checked));
}

function simpanPola(e) {
  e.preventDefault();
  const idx = $('po-asal').value === '' ? null : +$('po-asal').value;
  const d = {
    id: idx == null ? 'po-' + Date.now().toString(36) : proyek.polaOperasi[idx].id,
    nama: $('po-nama').value.trim(),
    saranaId: $('po-sarana').value,
    dari: $('po-dari').value, ke: $('po-ke').value,
    duaArah: $('po-duaarah').value === '1',
    jamMulai: $('po-mulai').value, jamAkhir: $('po-akhir').value,
    headway: Number($('po-headway').value),
    dwell: Number($('po-dwell').value) || 0,
    nomorAwal: parseInt($('po-nomor').value, 10),
    langkahNomor: parseInt($('po-langkah').value, 10),
    berhentiSemua: $('po-berhenti-semua').value === '1',
    berhentiDi: Array.from($('po-pilih').querySelectorAll('input:checked')).map(x => x.value)
  };
  if (!d.nama) return peringatan('Nama pola wajib diisi.');
  if (d.dari === d.ke) return peringatan('Relasi harus antara dua stasiun berbeda.');
  if (!(d.headway > 0)) return peringatan('Headway harus lebih dari 0 menit.');
  const m = TTCJadwal.jamKeDetik(d.jamMulai), a = TTCJadwal.jamKeDetik(d.jamAkhir);
  if (m == null || a == null || a <= m) return peringatan('Jam akhir harus setelah jam mulai.');
  if (idx == null) proyek.polaOperasi.push(d); else proyek.polaOperasi[idx] = d;
  peringatan(''); tutup('modal-pola'); renderSemua(); toast('Pola operasi disimpan.');
}


/* ============================================================
   SINYAL & BLOK
   ============================================================ */
const dtk = d => (d / 60).toFixed(2).replace('.', ',') + ' mnt';

function renderBlok() {
  const pj = proyek.prasarana.petakJalan;
  $('empty-blok').classList.toggle('hidden', pj.length > 0);
  $('kpi-blok-total').textContent = pj.length;
  $('kpi-blok-petak').textContent = pj.filter(x => TTCModel.jumlahBlok(x, 'hilir') > 0).length;
  renderParameterSinyal();

  if (!pj.length || !proyek.sarana.length) {
    tabelBlok = []; $('tabel-blok').innerHTML = ''; $('count-blok').textContent = 0;
    ['kpi-blok-headway','kpi-blok-kapasitas','kpi-blok-pakai'].forEach(i => $(i).textContent = '—');
    return;
  }

  tabelBlok = TTCBlok.tabelHeadway(proyek);
  const sempit = TTCBlok.bottleneck(tabelBlok);
  $('count-blok').textContent = tabelBlok.length;

  $('kpi-blok-headway').textContent = sempit ? dtk(sempit.headwayMaks) : '—';
  $('kpi-blok-dimana').textContent = sempit ? 'di petak ' + sempit.dari + '–' + sempit.ke : '—';
  $('kpi-blok-kapasitas').textContent = sempit ? sempit.kapasitas : '—';

  const hwPola = proyek.polaOperasi.length
    ? Math.min(...proyek.polaOperasi.map(p => Number(p.headway) || 999)) * 60 : 0;
  if (hwPola && sempit) {
    $('kpi-blok-pakai').textContent = (hwPola / 60).toFixed(0) + ' mnt';
    const cukup = hwPola >= sempit.headwayMaks;
    $('kpi-blok-status').textContent = cukup ? 'memenuhi blok yang ada' : 'LEBIH RAPAT dari yang mampu dilayani blok';
    $('kpi-blok-pakai').parentElement.classList.toggle('alert', !cukup);
    $('kpi-blok-pakai').parentElement.dataset.aman = cukup ? '1' : '0';
  } else {
    $('kpi-blok-pakai').textContent = '—'; $('kpi-blok-status').textContent = 'belum ada pola operasi';
  }

  $('tabel-blok').innerHTML = tabelBlok.map((r, i) =>
    '<tr data-i="' + i + '" class="' + (sempit && r.kunci === sempit.kunci ? 'sempit' : '') +
      (petakTerpilih === i ? ' terpilih' : '') + '">' +
    '<td><b>' + esc(r.dari) + '–' + esc(r.ke) + '</b></td>' +
    '<td><span class="pill' + (r.jenisJalur === 'Tunggal' ? ' tunggal' : '') + '">' + esc(r.jenisJalur) + '</span></td>' +
    '<td class="num">' + num(r.jarak, 2) + '</td>' +
    '<td class="num">' + r.jumlahBlok + '</td>' +
    '<td class="num">' + num(r.panjangBlokRata, 0) + ' m</td>' +
    '<td class="num">' + dtk(r.headwayHilir) + '</td>' +
    '<td class="num">' + dtk(r.headwayHulu) + '</td>' +
    '<td class="num"><b>' + r.kapasitas + '</b> KA/j</td>' +
    '<td>' + esc(r.blokPenentu) + '</td>' +
    '<td class="aksi"><button class="row-action" data-ubah="' + i + '">Atur blok</button></td></tr>').join('');

  $('tabel-blok').querySelectorAll('tr').forEach(tr =>
    tr.onclick = () => { petakTerpilih = +tr.dataset.i; renderBlok(); gambarSkemaBlok(); });
  $('tabel-blok').querySelectorAll('[data-ubah]').forEach(b =>
    b.onclick = e => { e.stopPropagation(); bukaModalBlok(+b.dataset.ubah); });

  if (petakTerpilih == null && tabelBlok.length) petakTerpilih = sempit
    ? tabelBlok.findIndex(x => x.kunci === sempit.kunci) : 0;
  gambarSkemaBlok();
}

function renderParameterSinyal() {
  const g = proyek.parameter.sinyal || {};
  $('sg-rute').value = g.waktuBentukRute;
  $('sg-pandang').value = g.waktuPandang;
  $('sg-lepas').value = g.waktuLepas;
  $('sg-vbebas').value = g.kecepatanBebasMin;
  $('sg-margin').value = g.margin;
}
function bacaParameterSinyal() {
  const g = proyek.parameter.sinyal;
  g.waktuBentukRute = Number($('sg-rute').value) || 0;
  g.waktuPandang = Number($('sg-pandang').value) || 0;
  g.waktuLepas = Number($('sg-lepas').value) || 0;
  g.kecepatanBebasMin = Number($('sg-vbebas').value) || 20;
  g.margin = Number($('sg-margin').value) || 0;
  renderBlok(); simpanOtomatis();
}

const NSVG = 'http://www.w3.org/2000/svg';
const svgEl = (t, a) => { const e = document.createElementNS(NSVG, t); for (const k in a) e.setAttribute(k, a[k]); return e; };

function gambarSkemaBlok() {
  const svg = $('skema-blok'), tangga = $('tangga-blok');
  svg.innerHTML = ''; tangga.innerHTML = '';
  $('rincian-blok').innerHTML = '';
  const r = tabelBlok[petakTerpilih];
  if (!r) { $('skema-judul').textContent = '—'; return; }
  const petak = TTCModel.cariPetak(proyek, r.dari, r.ke);
  const sarana = TTCBlok.saranaDipakai(proyek)[0];
  if (!petak || !sarana) return;

  const hasil = TTCBlok.hitungPetak(proyek, sarana, petak, 'hilir', {});
  $('skema-judul').textContent = r.dari + '–' + r.ke;
  $('skema-note').textContent = 'Sarana acuan: ' + sarana.nama + ' · ' + hasil.blok.length +
    ' blok · waktu tempuh ' + (hasil.waktuTempuh / 60).toFixed(2) + ' menit · headway minimum ' +
    dtk(hasil.headwayMin) + ' (blok ' + hasil.blokPenentu + ').';

  /* ---- skema blok ---- */
  const W = 700, total = Number(petak.jarak) * 1000;
  const X = m => 50 + (m / total) * (W - 100);
  const yRel = 62;
  svg.appendChild(svgEl('line', { x1: X(0), y1: yRel, x2: X(total), y2: yRel, class: 'sk-rel' }));
  const s1 = svgEl('text', { x: X(0), y: 30, class: 'sk-stasiun', 'text-anchor': 'start' }); s1.textContent = r.dari;
  const s2 = svgEl('text', { x: X(total), y: 30, class: 'sk-stasiun', 'text-anchor': 'end' }); s2.textContent = r.ke;
  svg.appendChild(s1); svg.appendChild(s2);

  hasil.blok.forEach(b => {
    const x1 = X(b.sMulai), x2 = X(b.sSelesai);
    if (b.nama === hasil.blokPenentu)
      svg.appendChild(svgEl('rect', { x: x1, y: yRel - 13, width: Math.max(2, x2 - x1), height: 26, class: 'sk-penentu' }));
    // sinyal di awal blok
    svg.appendChild(svgEl('line', { x1: x1, y1: yRel, x2: x1, y2: yRel - 22, class: 'sk-sinyal-tiang' }));
    svg.appendChild(svgEl('circle', { cx: x1, cy: yRel - 25, r: 4, class: 'sk-sinyal-lampu' }));
    svg.appendChild(svgEl('line', { x1: x1, y1: yRel - 8, x2: x1, y2: yRel + 8, class: 'sk-batas' }));
    const t1 = svgEl('text', { x: (x1 + x2) / 2, y: yRel + 24, class: 'sk-blok' }); t1.textContent = b.nama.split('/').pop();
    const t2 = svgEl('text', { x: (x1 + x2) / 2, y: yRel + 36, class: 'sk-panjang' }); t2.textContent = Math.round(b.panjang) + ' m';
    svg.appendChild(t1); svg.appendChild(t2);
  });
  svg.appendChild(svgEl('line', { x1: X(total), y1: yRel - 8, x2: X(total), y2: yRel + 8, class: 'sk-batas' }));
  svg.setAttribute('viewBox', '0 0 ' + W + ' 110');

  /* ---- tangga blocking time ---- */
  const H = 260, ML = 62, MB = 30, MT = 16;
  const tMaks = Math.max(...hasil.blok.map(b => b.tMasuk - (b.rincian.pandang + b.rincian.pendekat + b.rincian.rute) + b.blocking)) * 1.05;
  const TX = t => ML + (t / tMaks) * (W - ML - 16);
  const n = hasil.blok.length;
  const BH = (H - MT - MB) / n;

  for (let t = 0; t <= tMaks; t += 60) {
    tangga.appendChild(svgEl('line', { x1: TX(t), y1: MT, x2: TX(t), y2: H - MB, class: 'tg-kisi' }));
    const lb = svgEl('text', { x: TX(t) + 2, y: H - MB + 12, class: 'tg-label' });
    lb.textContent = (t / 60).toFixed(0) + 'm';
    tangga.appendChild(lb);
  }
  tangga.appendChild(svgEl('line', { x1: ML, y1: MT, x2: ML, y2: H - MB, class: 'tg-sumbu' }));

  hasil.blok.forEach((b, i) => {
    const y = MT + i * BH;
    const mulai = b.tMasuk - b.rincian.rute - b.rincian.pandang - b.rincian.pendekat;
    const x1 = TX(Math.max(0, mulai)), x2 = TX(Math.max(0, mulai) + b.blocking);
    tangga.appendChild(svgEl('rect', {
      x: x1, y: y + 2, width: Math.max(2, x2 - x1), height: BH - 4,
      class: 'tg-bar' + (b.nama === hasil.blokPenentu ? ' penentu' : '')
    }));
    const nm = svgEl('text', { x: ML - 5, y: y + BH / 2 + 3, class: 'tg-nama', 'text-anchor': 'end' });
    nm.textContent = b.nama.split('/').pop();
    tangga.appendChild(nm);
  });
  // lintasan kereta
  const jalur = hasil.blok.map((b, i) => [TX(b.tMasuk), MT + i * BH + BH / 2]);
  jalur.push([TX(hasil.blok[n - 1].tKeluar), MT + (n - 1) * BH + BH]);
  tangga.appendChild(svgEl('path', {
    d: jalur.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '),
    class: 'tg-lintasan'
  }));
  tangga.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

  /* ---- rincian blok penentu ---- */
  const bp = hasil.blok.find(b => b.nama === hasil.blokPenentu) || hasil.blok[0];
  const nama = { rute: 'Pembentukan rute', pandang: 'Waktu pandang sinyal', pendekat: 'Waktu pendekat (blok sebelumnya)',
                 tempuh: 'Waktu tempuh blok', bebas: 'Pembebasan (panjang rangkaian)', lepas: 'Pelepasan blok', margin: 'Cadangan' };
  $('rincian-blok').innerHTML = '<table><tbody>' +
    Object.keys(nama).map(k => '<tr><td>' + nama[k] + '</td><td>' + bp.rincian[k].toFixed(1) + ' dtk</td></tr>').join('') +
    '<tr class="total"><td>Headway minimum petak ini</td><td>' + bp.blocking.toFixed(0) + ' dtk = ' +
    dtk(bp.blocking) + '</td></tr></tbody></table>';
}

/* ---------- modal atur blok ---------- */
function barisBlok(nama, panjang) {
  const d = document.createElement('div');
  d.className = 'bk-baris';
  d.innerHTML = '<input class="bk-nama" value="' + esc(nama) + '" placeholder="nama blok">' +
                '<input class="bk-pj" type="number" min="1" step="10" value="' + esc(panjang) + '">' +
                '<button type="button" title="Hapus">×</button>';
  d.querySelector('button').onclick = () => { d.remove(); jumlahkanBlok(); };
  d.querySelector('.bk-pj').oninput = jumlahkanBlok;
  return d;
}
function jumlahkanBlok() {
  const idx = +$('bk-index').value;
  const petak = proyek.prasarana.petakJalan[idx];
  const total = Array.from($('bk-daftar').querySelectorAll('.bk-pj')).reduce((s, i) => s + (Number(i.value) || 0), 0);
  const target = Number(petak.jarak) * 1000;
  const selisih = total - target;
  $('bk-jumlahkan').textContent = 'Jumlah ' + Math.round(total) + ' m dari panjang petak ' + Math.round(target) +
    ' m' + (Math.abs(selisih) > 1 ? ' — selisih ' + (selisih > 0 ? '+' : '') + Math.round(selisih) + ' m akan diskalakan otomatis.' : ' — pas.');
}
function bukaModalBlok(i) {
  const r = tabelBlok[i];
  const idx = proyek.prasarana.petakJalan.findIndex(p =>
    TTCBlok.kunciPetak(p.dari, p.ke) === r.kunci);
  if (idx < 0) return;
  const petak = proyek.prasarana.petakJalan[idx];
  $('bk-index').value = String(idx);
  $('mb-judul').textContent = 'Blok Petak ' + petak.dari + '–' + petak.ke +
    ' (' + num(petak.jarak, 3) + ' km)';
  const daftar = TTCBlok.daftarBlok(petak, 'hilir');
  $('bk-jumlah').value = daftar.length;
  $('bk-daftar').innerHTML = '';
  daftar.forEach(b => $('bk-daftar').appendChild(barisBlok(b.nama, Math.round(b.panjang))));
  jumlahkanBlok();
  buka('modal-blok');
}
function simpanBlok(e) {
  e.preventDefault();
  const idx = +$('bk-index').value;
  const petak = proyek.prasarana.petakJalan[idx];
  const baris = Array.from($('bk-daftar').querySelectorAll('.bk-baris')).map((d, i) => ({
    nama: d.querySelector('.bk-nama').value.trim() || ('B' + (i + 1)),
    panjang: Number(d.querySelector('.bk-pj').value) || 0
  })).filter(b => b.panjang > 0);
  if (!baris.length) return peringatan('Minimal satu blok.');
  const hulu = $('bk-hulu').value === 'sama'
    ? baris.map(b => ({ ...b }))
    : baris.map(b => ({ ...b })).reverse();
  petak.blok = { hilir: baris, hulu: hulu };
  peringatan(''); tutup('modal-blok'); petakTerpilih = null; renderSemua(); renderBlok();
  toast('Blok petak ' + petak.dari + '–' + petak.ke + ' disimpan (' + baris.length + ' blok).');
}
function bagiSemuaBlok() {
  const t = Number($('blok-target').value) || 1000;
  if (!(t >= 100)) return peringatan('Panjang blok minimal 100 m.');
  proyek.prasarana.petakJalan.forEach(p => TTCModel.bagiBlokRata(p, t));
  petakTerpilih = null; renderSemua(); renderBlok();
  toast('Seluruh petak dibagi menjadi blok ±' + t + ' m.');
}



/* ============================================================
   EMPLASEMEN
   ============================================================ */
function templateUntuk(jumlahJalur) {
  const n = Number(jumlahJalur) || 2;
  return n <= 1 ? 'perhentian' : n === 2 ? 'j2' : n === 3 ? 'j3' : n === 4 ? 'j4' : n === 5 ? 'j5' : 'j6';
}
function stasiunLintasGanda(kode) {
  const tetangga = proyek.prasarana.petakJalan.filter(p => p.dari === kode || p.ke === kode);
  if (!tetangga.length) return true;
  return tetangga.every(p => p.jenisJalur === 'Ganda');
}

function renderEmplasemen() {
  const st = proyek.prasarana.stasiun;
  const stat = TTCEmplasemen.statistik(proyek);
  $('kpi-emp-st').textContent = stat.digambar;
  $('kpi-emp-total').textContent = stat.total;
  $('kpi-emp-jalur').textContent = stat.jalur;
  $('kpi-emp-wesel').textContent = stat.wesel;
  $('kpi-emp-rute').textContent = stat.rute;

  // pilihan stasiun
  const sel = $('emp-stasiun');
  const dulu = empKode || sel.value;
  sel.innerHTML = st.map(x => '<option value="' + esc(x.kode) + '">' + esc(x.kode) + ' — ' + esc(x.nama) +
    (x.layout ? ' ✓' : '') + '</option>').join('');
  if (dulu && st.some(x => x.kode === dulu)) sel.value = dulu;
  empKode = sel.value || (st[0] && st[0].kode) || null;

  if ($('emp-template').options.length === 0) {
    $('emp-template').innerHTML = Object.keys(TTCEmplasemen.TEMPLATE)
      .map(k => '<option value="' + k + '">' + esc(TTCEmplasemen.TEMPLATE[k].nama) + '</option>').join('');
    $('emp-wesel').innerHTML = Object.keys(TTCEmplasemen.TIPE_WESEL)
      .map(k => '<option value="' + k + '"' + (k === '1:12' ? ' selected' : '') + '>' + k +
        ' (belok ' + TTCEmplasemen.TIPE_WESEL[k].kecepatanBelok + ' km/jam)</option>').join('');
  }

  const s = TTCModel.cariStasiun(proyek, empKode);
  const L = s ? s.layout : null;
  if (s && !L) {
    $('emp-template').value = templateUntuk(s.jumlahJalur);
    $('emp-ganda').value = stasiunLintasGanda(s.kode) ? '1' : '0';
  } else if (L) {
    $('emp-template').value = L.template || templateUntuk(s.jumlahJalur);
    $('emp-ganda').value = L.ganda === false ? '0' : '1';
    if (L.wesel[0]) $('emp-wesel').value = L.wesel[0].tipe;
    if (L.jalur[0]) $('emp-panjang').value = L.jalur[0].panjangEfektif;
  }
  $('emp-judul').textContent = s ? s.kode + ' — ' + s.nama : '—';
  $('emp-note').textContent = L
    ? 'Layout aktif: ' + (TTCEmplasemen.TEMPLATE[L.template] || {}).nama + ' · ' +
      (L.ganda === false ? 'lintas tunggal' : 'lintas ganda') + '. Ubah isian di tabel di bawah bila berbeda dengan emplasemen sebenarnya.'
    : 'Stasiun ini belum punya layout. Pilih template lalu tekan Terapkan.';

  renderTabelEmplasemen(L);
  gambarEmplasemen(s, L);
}

function renderTabelEmplasemen(L) {
  const jb = $('tabel-emp-jalur'), wb = $('tabel-emp-wesel'), rb = $('tabel-emp-rute');
  $('empty-emp-jalur').classList.toggle('hidden', !!(L && L.jalur.length));
  $('empty-emp-wesel').classList.toggle('hidden', !!(L && L.wesel.length));
  $('empty-emp-rute').classList.toggle('hidden', !!(L && L.rute.length));
  if (!L) { jb.innerHTML = ''; wb.innerHTML = ''; rb.innerHTML = '';
    ['count-emp-jalur','count-emp-wesel','count-emp-rute'].forEach(i => $(i).textContent = 0); return; }

  $('count-emp-jalur').textContent = L.jalur.length;
  $('count-emp-wesel').textContent = L.wesel.length;
  $('count-emp-rute').textContent = L.rute.length;

  jb.innerHTML = L.jalur.map((j, i) =>
    '<tr><td><b>' + esc(j.no) + '</b></td>' +
    '<td><input class="mini-cell" data-j="' + i + '" data-f="nama" value="' + esc(j.nama) + '"></td>' +
    '<td class="num"><input class="mini-cell num" type="number" min="0" step="10" data-j="' + i + '" data-f="panjangEfektif" value="' + esc(j.panjangEfektif) + '"></td>' +
    '<td><select class="mini-cell" data-j="' + i + '" data-f="peron"><option value="1"' + (j.peron ? ' selected' : '') + '>Ya</option><option value="0"' + (!j.peron ? ' selected' : '') + '>Tidak</option></select></td>' +
    '<td><select class="mini-cell" data-j="' + i + '" data-f="arahLazim">' +
      ['hilir','hulu','dua'].map(a => '<option value="' + a + '"' + (j.arahLazim === a ? ' selected' : '') + '>' + (a === 'dua' ? 'Dua arah' : a) + '</option>').join('') +
    '</select></td></tr>').join('');
  jb.querySelectorAll('[data-j]').forEach(el => el.onchange = () => {
    const j = L.jalur[+el.dataset.j], f = el.dataset.f;
    if (f === 'peron') j.peron = el.value === '1';
    else if (f === 'panjangEfektif') j.panjangEfektif = Number(el.value) || 0;
    else j[f] = el.value;
    L.rute = TTCEmplasemen.buatRute(L, 60);
    renderSemua(); toast('Jalur diperbarui.');
  });

  wb.innerHTML = L.wesel.map((w, i) =>
    '<tr><td><b>' + esc(w.no) + '</b></td><td>' + esc(w.sisi) + '</td>' +
    '<td>' + esc(w.kelompok || 'dua') + '</td>' +
    '<td><select class="mini-cell" data-w="' + i + '">' +
      Object.keys(TTCEmplasemen.TIPE_WESEL).map(k => '<option value="' + k + '"' + (w.tipe === k ? ' selected' : '') + '>' + k + '</option>').join('') +
    '</select></td>' +
    '<td class="num">' + esc(w.kecepatanBelok) + ' km/j</td></tr>').join('');
  wb.querySelectorAll('[data-w]').forEach(el => el.onchange = () => {
    const w = L.wesel[+el.dataset.w];
    w.tipe = el.value;
    w.kecepatanBelok = TTCEmplasemen.TIPE_WESEL[el.value].kecepatanBelok;
    L.rute = TTCEmplasemen.buatRute(L, 60);
    renderSemua(); toast('Wesel ' + w.no + ' diubah menjadi ' + w.tipe + '.');
  });

  rb.innerHTML = L.rute.map(r => {
    const bentrok = L.rute.filter(x => x.id !== r.id && TTCEmplasemen.ruteBentrok(r, x)).map(x => x.nama);
    return '<tr><td><b>' + esc(r.nama) + '</b></td><td>' + esc(r.jenis) + '</td>' +
      '<td><span class="pill ' + esc(r.arah) + '">' + esc(r.arah) + '</span></td>' +
      '<td>' + esc(r.jalur) + '</td><td class="num">' + esc(r.kecepatan) + ' km/j</td>' +
      '<td><code style="font-size:11px">' + esc(r.elemen.join(' · ')) + '</code></td>' +
      '<td style="color:var(--ink-3);font-size:11.5px">' + (bentrok.length ? esc(bentrok.join('; ')) : '—') + '</td></tr>';
  }).join('');
}

function gambarEmplasemen(s, L) {
  const svg = $('skema-emplasemen'); svg.innerHTML = '';
  if (!s || !L) { svg.setAttribute('viewBox', '0 0 1000 80'); return; }
  const W = 1000;
  const jalur = L.jalur;
  const kelAwal = TTCEmplasemen.kelompokJalur(jalur, L.ganda !== false);
  const BARIS = 34;
  const H = 70 + jalur.length * BARIS;
  const tingkat = Math.max(1, Math.max.apply(null, Object.keys(kelAwal).map(g => kelAwal[g].length)) - 1);
  const lebarThroat = 70 + tingkat * 32;
  const xKiri = 30, xThroatKiri = 30 + lebarThroat, xThroatKanan = W - 30 - lebarThroat, xKanan = W - 30;
  const yJ = i => 52 + i * BARIS;

  const kel = kelAwal;

  // garis lintas bebas kiri & kanan (satu per kelompok)
  Object.keys(kel).forEach(g => {
    const utama = kel[g][0];
    if (!utama) return;
    const y = yJ(jalur.indexOf(utama));
    svg.appendChild(svgEl('line', { x1: xKiri, y1: y, x2: xThroatKiri, y2: y, class: 'em-lead' }));
    svg.appendChild(svgEl('line', { x1: xThroatKanan, y1: y, x2: xKanan, y2: y, class: 'em-lead' }));
    const t1 = svgEl('text', { x: xKiri, y: y - 8, class: 'em-arah' }); t1.textContent = '← ' + (g === 'hulu' ? 'hulu' : 'barat');
    const t2 = svgEl('text', { x: xKanan, y: y - 8, class: 'em-arah', 'text-anchor': 'end' }); t2.textContent = (g === 'hilir' ? 'hilir' : 'timur') + ' →';
    svg.appendChild(t1); svg.appendChild(t2);
  });

  jalur.forEach((j, i) => {
    const y = yJ(i);
    svg.appendChild(svgEl('line', { x1: xThroatKiri, y1: y, x2: xThroatKanan, y2: y,
      class: 'em-jalur' + (j.badug ? ' badug' : '') }));
    void 0;
    if (j.peron) {
      svg.appendChild(svgEl('rect', { x: xThroatKiri + 20, y: y + 6, width: (xThroatKanan - xThroatKiri) - 40, height: 8, class: 'em-peron' }));
      const pl = svgEl('text', { x: (xThroatKiri + xThroatKanan) / 2, y: y + 22, class: 'em-peronlabel' }); pl.textContent = 'peron';
      svg.appendChild(pl);
    }
    const nm = svgEl('text', { x: xThroatKiri + 6, y: y - 7, class: 'em-nama' }); nm.textContent = j.nama;
    const inf = svgEl('text', { x: xThroatKanan - 6, y: y - 7, class: 'em-info', 'text-anchor': 'end' });
    inf.textContent = j.panjangEfektif + ' m · ' + (j.arahLazim === 'dua' ? '2 arah' : j.arahLazim);
    svg.appendChild(nm); svg.appendChild(inf);
  });

  // Wesel digambar sebagai tangga: tiap wesel duduk di jalur satu tingkat
  // di atasnya, dan kaki beloknya turun ke jalur cabang — sebagaimana
  // tata letak tangga di emplasemen sungguhan.
  const STEP = 32;
  Object.keys(kel).forEach(g => {
    const isi = kel[g];
    ['barat', 'timur'].forEach(sisi => {
      const w = L.wesel.filter(x => x.sisi === sisi && (x.kelompok || 'dua') === g)
        .sort((a, b) => Number(a.no.replace(/\D/g, '')) - Number(b.no.replace(/\D/g, '')));
      w.forEach(wx => {
        const k = Number(wx.no.replace(/\D/g, ''));
        const cabang = isi[k], atas = isi[k - 1];
        if (!cabang || !atas) return;
        const yA = yJ(jalur.indexOf(atas)), yC = yJ(jalur.indexOf(cabang));
        const barat = sisi === 'barat';
        const xUjung = barat ? xThroatKiri - (k - 1) * STEP : xThroatKanan + (k - 1) * STEP;
        const xWesel = barat ? xUjung - STEP : xUjung + STEP;
        // perpanjangan jalur cabang sampai kaki wesel
        if (k > 1) svg.appendChild(svgEl('line', {
          x1: barat ? xUjung : xThroatKanan, y1: yC,
          x2: barat ? xThroatKiri : xUjung, y2: yC, class: 'em-lead' }));
        // kaki belok
        svg.appendChild(svgEl('line', { x1: xWesel, y1: yA, x2: xUjung, y2: yC, class: 'em-lead' }));
        // sambungan lurus jalur induk melewati wesel
        svg.appendChild(svgEl('line', {
          x1: barat ? xWesel : (k === 1 ? xThroatKanan : xUjung), y1: yA,
          x2: barat ? (k === 1 ? xThroatKiri : xUjung) : xWesel, y2: yA, class: 'em-lead' }));
        svg.appendChild(svgEl('circle', { cx: xWesel, cy: yA, r: 3, class: 'em-wesel' }));
        const t = svgEl('text', { x: xWesel, y: yA - 7, class: 'em-weselno' });
        t.textContent = wx.no; svg.appendChild(t);
      });
    });
  });

  const jud = svgEl('text', { x: xKiri, y: 22, class: 'em-nama' });
  jud.textContent = s.kode + ' — ' + s.nama + '  ·  ' + (L.ganda === false ? 'lintas tunggal' : 'lintas ganda');
  svg.appendChild(jud);
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
}

function terapkanTemplate() {
  const s = TTCModel.cariStasiun(proyek, empKode);
  if (!s) return;
  s.layout = TTCEmplasemen.buatLayout($('emp-template').value, {
    panjangEfektif: Number($('emp-panjang').value) || 250,
    tipeWesel: $('emp-wesel').value,
    ganda: $('emp-ganda').value === '1',
    kecepatanLurus: 60
  });
  renderSemua(); toast('Layout ' + s.kode + ' diterapkan.');
}
function bangunSemuaEmplasemen() {
  if (!confirm('Bangun layout untuk seluruh stasiun dari jumlah jalurnya?\nLayout yang sudah ada akan diganti.')) return;
  const pj = Number($('emp-panjang').value) || 250;
  const tw = $('emp-wesel').value;
  proyek.prasarana.stasiun.forEach(s => {
    s.layout = TTCEmplasemen.buatLayout(templateUntuk(s.jumlahJalur), {
      panjangEfektif: pj, tipeWesel: tw, ganda: stasiunLintasGanda(s.kode), kecepatanLurus: 60
    });
  });
  renderSemua(); toast(proyek.prasarana.stasiun.length + ' emplasemen dibangun.');
}

/* ============================================================
   SINYAL
   ============================================================ */
function renderSinyal() {
  const daftar = TTCSinyal.semua(proyek);
  const fa = $('filter-sinyal-arah').value, fj = $('filter-sinyal-jenis').value;
  const tampil = daftar.filter(x => (!fa || x.arah === fa) && (!fj || x.jenis === fj))
                       .slice().sort((a, b) => a.km - b.km || String(a.nomor).localeCompare(b.nomor));

  $('kpi-sg-jml').textContent = daftar.length;
  const bh = TTCSinyal.blokLintas(proyek, 'hilir'), bu = TTCSinyal.blokLintas(proyek, 'hulu');
  $('kpi-sg-hilir').textContent = bh.length;
  $('kpi-sg-hulu').textContent = bu.length;
  const semuaBlok = bh.concat(bu);
  if (semuaBlok.length) {
    const pendek = semuaBlok.reduce((a, b) => b.panjang < a.panjang ? b : a);
    $('kpi-sg-pendek').textContent = Math.round(pendek.panjang) + ' m';
    $('kpi-sg-pendek-nama').textContent = pendek.nama;
  } else { $('kpi-sg-pendek').textContent = '—'; $('kpi-sg-pendek-nama').textContent = '—'; }

  $('count-sinyal').textContent = tampil.length;
  $('empty-sinyal').classList.toggle('hidden', tampil.length > 0);
  $('tabel-sinyal').innerHTML = tampil.map(x => {
    const i = daftar.indexOf(x);
    const lind = x.melindungi ? (daftar.find(y => y.id === x.melindungi) || {}).nomor : '';
    return '<tr><td><b>' + esc(x.nomor) + '</b></td>' +
      '<td class="num">' + num(x.km, 3) + '</td>' +
      '<td>' + esc(TTCSinyal.NAMA_JENIS[x.jenis] || x.jenis) + '</td>' +
      '<td><span class="pill ' + esc(x.arah) + '">' + esc(x.arah) + '</span></td>' +
      '<td class="num">' + esc(x.aspek) + '</td>' +
      '<td>' + esc(x.stasiun || '—') + '</td>' +
      '<td>' + esc(lind || '—') + '</td>' +
      '<td class="aksi"><button class="row-action" data-ubah="' + i + '">Ubah</button>' +
      '<button class="row-action hapus" data-hapus="' + i + '">Hapus</button></td></tr>';
  }).join('');
  $('tabel-sinyal').querySelectorAll('[data-ubah]').forEach(b => b.onclick = () => bukaModalSinyal(+b.dataset.ubah));
  $('tabel-sinyal').querySelectorAll('[data-hapus]').forEach(b => b.onclick = () => {
    daftar.splice(+b.dataset.hapus, 1); renderSemua(); toast('Sinyal dihapus.');
  });

  const cat = TTCSinyal.periksaSinyal(proyek);
  $('periksa-sinyal').innerHTML = cat.length
    ? cat.slice(0, 30).map(c => '<div><span class="pill ' + esc(c.bobot) + '">' + esc(c.bobot) + '</span><span>' + esc(c.pesan) + '</span></div>').join('')
    : '<div><span class="pill" style="background:#e6f4ec;border-color:#bfe3d0;color:var(--hijau)">baik</span><span class="ok">Letak sinyal wajar, tidak ada blok yang terlalu pendek atau terlalu panjang.</span></div>';

  gambarSkemaSinyal();
}

function gambarSkemaSinyal() {
  const svg = $('skema-sinyal'); svg.innerHTML = '';
  const st = proyek.prasarana.stasiun;
  if (!st.length) return;
  const W = 1100, H = 150, y = 78;
  const minKm = Math.min(...st.map(x => x.km)), maxKm = Math.max(...st.map(x => x.km));
  const span = Math.max(maxKm - minKm, 0.001);
  const X = km => 30 + ((km - minKm) / span) * (W - 60);

  svg.appendChild(svgEl('line', { x1: X(minKm), y1: y, x2: X(maxKm), y2: y, class: 'sg-rel' }));
  st.forEach(x => {
    svg.appendChild(svgEl('line', { x1: X(x.km), y1: y - 40, x2: X(x.km), y2: y + 40, class: 'sg-st' }));
    const t = svgEl('text', { x: X(x.km), y: y + 54, class: 'sg-stlabel' }); t.textContent = x.kode;
    svg.appendChild(t);
  });

  const bentuk = (jenis, cx, cy) => {
    if (jenis === 'masuk') return svgEl('rect', { x: cx - 3.5, y: cy - 3.5, width: 7, height: 7, class: 'sg-dot masuk' });
    if (jenis === 'keluar') { const p = svgEl('path', { d: 'M' + cx + ' ' + (cy - 4) + 'L' + (cx + 4) + ' ' + (cy + 3) + 'L' + (cx - 4) + ' ' + (cy + 3) + 'Z', class: 'sg-dot keluar' }); return p; }
    if (jenis === 'muka') return svgEl('circle', { cx: cx, cy: cy, r: 3.4, class: 'sg-dot muka' });
    if (jenis === 'langsir') return svgEl('circle', { cx: cx, cy: cy, r: 2.6, class: 'sg-dot langsir' });
    return svgEl('circle', { cx: cx, cy: cy, r: 3.4, class: 'sg-dot blok' });
  };
  // Nomor sinyal hanya ditulis bila ada ruang; kalau berdesakan cukup
  // simbolnya, karena nomor lengkap sudah ada di tabel di bawah.
  const xTerakhir = { hilir: -999, hulu: -999 };
  TTCSinyal.semua(proyek).slice().sort((a, b) => a.km - b.km).forEach(sg => {
    const cx = X(Number(sg.km));
    const atas = sg.arah === 'hilir';
    const cy = atas ? y - 20 : y + 20;
    svg.appendChild(svgEl('line', { x1: cx, y1: y, x2: cx, y2: cy, class: 'sg-tiang' }));
    svg.appendChild(bentuk(sg.jenis, cx, cy));
    const kunci = sg.arah;
    if (sg.jenis !== 'muka' && cx - xTerakhir[kunci] >= 34) {
      const t = svgEl('text', { x: cx, y: atas ? cy - 8 : cy + 14, class: 'sg-nomor' });
      t.textContent = sg.nomor; svg.appendChild(t);
      xTerakhir[kunci] = cx;
    }
  });
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
}

function isiPilihanSinyal() {
  const d = TTCSinyal.semua(proyek).filter(x => TTCSinyal.JENIS_UTAMA.indexOf(x.jenis) >= 0);
  $('sy-lindung').innerHTML = '<option value="">—</option>' +
    d.map(x => '<option value="' + esc(x.id) + '">' + esc(x.nomor) + ' (km ' + num(x.km, 2) + ')</option>').join('');
  $('sy-stasiun').innerHTML = '<option value="">—</option>' +
    proyek.prasarana.stasiun.map(x => '<option value="' + esc(x.kode) + '">' + esc(x.kode) + ' — ' + esc(x.nama) + '</option>').join('');
}

function bukaModalSinyal(i) {
  const baru = (i == null);
  const d = TTCSinyal.semua(proyek);
  const x = baru ? { nomor: '', km: '', jenis: 'blok', arah: 'hilir', aspek: 3, stasiun: '', melindungi: '' } : d[i];
  $('msg-judul').textContent = baru ? 'Tambah Sinyal' : 'Ubah Sinyal ' + x.nomor;
  $('sy-asal').value = baru ? '' : String(i);
  isiPilihanSinyal();
  $('sy-nomor').value = x.nomor; $('sy-km').value = x.km; $('sy-jenis').value = x.jenis;
  $('sy-arah').value = x.arah; $('sy-aspek').value = x.aspek || 3;
  $('sy-stasiun').value = x.stasiun || ''; $('sy-lindung').value = x.melindungi || '';
  buka('modal-sinyal');
}

function simpanSinyal(e) {
  e.preventDefault();
  const d = TTCSinyal.semua(proyek);
  const i = $('sy-asal').value === '' ? null : +$('sy-asal').value;
  const x = {
    id: i == null ? 'sg-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) : d[i].id,
    nomor: $('sy-nomor').value.trim(),
    km: Number($('sy-km').value),
    jenis: $('sy-jenis').value, arah: $('sy-arah').value,
    aspek: parseInt($('sy-aspek').value, 10),
    stasiun: $('sy-stasiun').value || null,
    melindungi: $('sy-lindung').value || null
  };
  if (!x.nomor) return peringatan('Nomor sinyal wajib diisi.');
  if (!Number.isFinite(x.km)) return peringatan('Km sinyal harus angka.');
  if (d.some((y, k) => y.nomor === x.nomor && k !== i)) return peringatan('Nomor sinyal ' + x.nomor + ' sudah dipakai.');
  if (i == null) d.push(x); else d[i] = x;
  peringatan(''); tutup('modal-sinyal'); renderSemua(); toast('Sinyal disimpan.');
}

/* ============================================================
   SIMULASI SINYAL
   ============================================================ */
function siapkanSimSinyal() {
  if (!proyek.jadwal.ka.length) { peringatan('Buat jadwal dulu sebelum menjalankan simulasi sinyal.'); return; }
  if (!TTCSinyal.adaSinyal(proyek)) { peringatan('Belum ada sinyal. Buka menu Sinyal dan bangun dulu.'); return; }
  if (!simop) {
    simop = TTCSimOp.buat(proyek);
    simop.setWaktu(TTCJadwal.jamKeDetik($('ss-mulai').value) || 5 * 3600);
  }
  perbaruiSimSinyal();
}
function resetSimSinyal() {
  ss.jalan = false; cancelAnimationFrame(ss.raf);
  simop = TTCSimOp.buat(proyek);
  simop.setWaktu(TTCJadwal.jamKeDetik($('ss-mulai').value) || 5 * 3600);
  perbaruiSimSinyal();
}
function langkahSimSinyal(ts) {
  if (!ss.jalan || !simop) return;
  if (!ss.terakhir) ss.terakhir = ts;
  const nyata = Math.min(0.25, (ts - ss.terakhir) / 1000);
  ss.terakhir = ts;
  let sisa = nyata * ss.kecepatan;
  let putar = 0;
  while (sisa > 0 && putar < 400) { const d = Math.min(1, sisa); simop.langkah(d); sisa -= d; putar++; }
  perbaruiSimSinyal();
  if (ss.jalan) ss.raf = requestAnimationFrame(langkahSimSinyal);
}

function perbaruiSimSinyal() {
  if (!simop) return;
  $('ss-jam').textContent = jam(simop.t, true).replace('⁺', '');
  const r = simop.ringkasan();
  $('ss-k-lintas').textContent = r.diLintas;
  $('ss-k-tertahan').textContent = r.tertahan;
  $('ss-k-parah').textContent = (r.terlambatTerparah / 60).toFixed(1);
  $('ss-k-tahan').textContent = simop.jumlahTertahan;
  $('ss-k-tertahan').parentElement.dataset.aman = r.tertahan ? '0' : '1';

  const aktif = simop.aktif().slice().sort((a, b) => a.km - b.km);
  $('empty-ss').classList.toggle('hidden', aktif.length > 0);
  $('tabel-ss').innerHTML = aktif.slice(0, 120).map(k =>
    '<tr><td><b>' + esc(k.nomor) + '</b></td>' +
    '<td><span class="pill ' + esc(k.arah) + '">' + esc(k.arah) + '</span></td>' +
    '<td class="num">' + num(k.km, 2) + '</td>' +
    '<td class="num">' + num(k.v * 3.6, 0) + ' km/j</td>' +
    '<td>' + esc(k.sinyalDepan || '—') + '</td>' +
    '<td>' + (k.aspekDepan ? '<span class="pill" style="border-color:' + k.aspekDepan.warna + ';color:' + k.aspekDepan.warna + '">' + esc(k.aspekDepan.label) + '</span>' : '—') + '</td>' +
    '<td>' + esc(k.status) + '</td>' +
    '<td class="num" style="color:' + (k.terlambat > 60 ? 'var(--merah)' : 'var(--ink-3)') + '">' +
      (k.terlambat >= 0 ? '+' : '−') + Math.abs(k.terlambat / 60).toFixed(1) + ' m</td></tr>').join('');

  gambarStrip();
}

function gambarStrip() {
  const svg = $('strip-lintas'); svg.innerHTML = '';
  const st = proyek.prasarana.stasiun;
  if (!st.length || !simop) return;
  const W = 1100, H = 190, y = 96;
  const minKm = Math.min(...st.map(x => x.km)), maxKm = Math.max(...st.map(x => x.km));
  const span = Math.max(maxKm - minKm, 0.001);
  const X = km => 30 + ((km - minKm) / span) * (W - 60);

  svg.appendChild(svgEl('line', { x1: X(minKm), y1: y, x2: X(maxKm), y2: y, class: 'sg-rel' }));
  st.forEach(x => {
    svg.appendChild(svgEl('line', { x1: X(x.km), y1: y - 12, x2: X(x.km), y2: y + 12, class: 'sg-st' }));
    const t = svgEl('text', { x: X(x.km), y: y + 26, class: 'sg-stlabel' }); t.textContent = x.kode;
    svg.appendChild(t);
  });

  // sinyal beserta aspeknya
  TTCSinyal.semua(proyek).forEach(sg => {
    if (TTCSinyal.JENIS_UTAMA.indexOf(sg.jenis) < 0) return;
    const a = simop.aspekSinyal[sg.id];
    const cx = X(Number(sg.km)), atas = sg.arah === 'hilir';
    const cy = atas ? y - 20 : y + 20;
    svg.appendChild(svgEl('line', { x1: cx, y1: atas ? y - 6 : y + 6, x2: cx, y2: cy, class: 'sg-tiang' }));
    svg.appendChild(svgEl('circle', { cx: cx, cy: cy, r: 3.6, fill: a ? a.warna : '#8593a0', stroke: '#fff', 'stroke-width': 1 }));
  });

  // kereta
  simop.aktif().forEach(k => {
    const cx = X(k.km), atas = k.arah === 'hilir';
    const cy = atas ? y - 40 : y + 44;
    const seg = svgEl('path', {
      d: atas ? 'M' + cx + ' ' + (cy + 7) + 'L' + (cx + 5) + ' ' + cy + 'L' + (cx - 5) + ' ' + cy + 'Z'
              : 'M' + cx + ' ' + (cy - 7) + 'L' + (cx + 5) + ' ' + cy + 'L' + (cx - 5) + ' ' + cy + 'Z',
      class: 'st-ka ' + k.arah
    });
    svg.appendChild(seg);
    if (k.status === 'tertahan')
      svg.appendChild(svgEl('circle', { cx: cx, cy: atas ? cy + 3 : cy - 3, r: 8, class: 'st-tertahan' }));
    const t = svgEl('text', { x: cx, y: atas ? cy - 5 : cy + 14, class: 'st-kanomor' });
    t.textContent = k.nomor; svg.appendChild(t);
  });
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
}

/* ============================================================
   JADWAL
   ============================================================ */
function buatJadwal() {
  if (!proyek.polaOperasi.length) return peringatan('Belum ada pola operasi. Buat satu pola dulu.');
  status('Menghitung dinamika perjalanan…');
  setTimeout(() => {
    const t0 = performance.now();
    const hasil = TTCJadwal.buatJadwal(proyek);
    proyek.jadwal = hasil;
    konflik = []; simop = null;
    kaTerpilih = null;
    const ms = Math.round(performance.now() - t0);
    peringatan(hasil.catatan.length ? hasil.catatan.join(' ') : '');
    renderSemua();
    pindahView('jadwal');
    status('Siap');
    toast(hasil.ka.length + ' perjalanan KA dibangkitkan dalam ' + ms + ' ms.');
  }, 20);
}

function daftarKAtersaring() {
  const arah = $('filter-arah').value;
  const cari = $('cari-ka').value.trim();
  return proyek.jadwal.ka.filter(k =>
    (!arah || k.arah === arah) && (!cari || String(k.nomor).includes(cari)));
}

function renderJadwal() {
  const semua = proyek.jadwal.ka;
  $('jadwal-sub').textContent = semua.length
    ? semua.length + ' perjalanan dibangkitkan dari ' + proyek.polaOperasi.length + ' pola operasi.'
    : 'Belum ada jadwal. Tekan “Buat Jadwal” pada bilah atas.';
  const list = daftarKAtersaring();
  $('count-ka').textContent = list.length;
  $('empty-ka').classList.toggle('hidden', list.length > 0);
  $('tabel-ka').innerHTML = list.map(k => {
    const r = TTCJadwal.ringkasKA(k);
    return '<tr data-nomor="' + esc(k.nomor) + '"' + (kaTerpilih === k.nomor ? ' class="terpilih"' : '') + '>' +
      '<td><b>' + esc(k.nomor) + '</b></td>' +
      '<td><span class="pill ' + esc(k.arah) + '">' + esc(k.arah) + '</span></td>' +
      '<td>' + esc(k.relasi) + '</td>' +
      '<td class="num">' + jam(r.berangkat) + '</td>' +
      '<td class="num">' + (r.tiba != null ? jam(r.tiba) : '—') + '</td>' +
      '<td class="num">' + Math.round(r.durasi / 60) + ' m</td>' +
      '<td class="num">' + num(r.kecepatanRata, 1) + '</td></tr>';
  }).join('');
  $('tabel-ka').querySelectorAll('tr').forEach(tr =>
    tr.onclick = () => { kaTerpilih = tr.dataset.nomor; renderJadwal(); renderDaftarWaktu(); });
  renderDaftarWaktu();
}

function renderDaftarWaktu() {
  const k = proyek.jadwal.ka.find(x => x.nomor === kaTerpilih);
  $('dw-nomor').textContent = k ? 'KA ' + k.nomor : '—';
  $('empty-dw').classList.toggle('hidden', !!k);
  if (!k) { $('tabel-dw').innerHTML = ''; return; }
  $('tabel-dw').innerHTML = k.perjalanan.map(t =>
    '<tr><td>' + esc(t.nama) + ' <span class="pill">' + esc(t.kode) + '</span></td>' +
    '<td class="num">' + num(t.km, 1) + '</td>' +
    '<td class="num">' + (t.datang != null ? jam(t.datang, true) : '—') + '</td>' +
    '<td class="num">' + (t.berangkat != null ? jam(t.berangkat, true) : '—') + '</td>' +
    '<td>' + (t.berhenti ? 'Berhenti' : '<span style="color:var(--ink-3)">Langsung</span>') + '</td></tr>').join('');
}

/* ============================================================
   KONFLIK
   ============================================================ */
function periksaKonflik() {
  if (!proyek.jadwal.ka.length) return peringatan('Belum ada jadwal untuk diperiksa.');
  status('Memeriksa konflik…');
  setTimeout(() => {
    const t0 = performance.now();
    konflik = TTCKonflik.periksa(proyek, proyek.jadwal);
    const ms = Math.round(performance.now() - t0);
    renderSemua();
    pindahView('konflik');
    status('Siap');
    toast(konflik.length ? konflik.length + ' konflik ditemukan (' + ms + ' ms).'
                         : 'Tidak ada konflik ditemukan (' + ms + ' ms).', konflik.length > 0);
  }, 20);
}

function renderKonflik() {
  $('konflik-sub').textContent = !proyek.jadwal.ka.length ? 'Belum ada jadwal.'
    : (konflik.length ? konflik.length + ' temuan pada ' + proyek.jadwal.ka.length + ' perjalanan.'
                      : 'Tidak ada konflik pada ' + proyek.jadwal.ka.length + ' perjalanan.');
  $('empty-konflik').classList.toggle('hidden', konflik.length > 0);
  $('tabel-konflik').innerHTML = konflik.slice(0, 500).map(c =>
    '<tr><td class="num">' + jam(c.waktu) + '</td><td>' + esc(c.jenis) + '</td>' +
    '<td><span class="pill ' + esc(c.bobot) + '">' + esc(c.bobot) + '</span></td>' +
    '<td>' + esc(c.lokasi) + '</td><td>' + esc((c.ka || []).join(', ')) + '</td>' +
    '<td>' + esc(c.pesan) + '</td></tr>').join('');
}

/* ============================================================
   PETA JALUR
   ============================================================ */
function gambarPeta() {
  const svg = $('network-svg');
  const st = proyek.prasarana.stasiun;
  $('empty-map').classList.toggle('hidden', st.length > 0);
  svg.innerHTML = '';
  $('peta-sub').textContent = st.length
    ? st.length + ' stasiun · ' + proyek.prasarana.petakJalan.length + ' petak · panjang ' + num(panjangLintas(), 1) + ' km'
    : 'Skema lintas berskala jarak.';
  if (!st.length) return;

  const NS = 'http://www.w3.org/2000/svg';
  const mk = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const minKm = Math.min(...st.map(s => Number(s.km))), maxKm = Math.max(...st.map(s => Number(s.km)));
  const span = Math.max(maxKm - minKm, 0.001);
  const X = km => 70 + ((Number(km) - minKm) / span) * 960;
  const Y = i => 210 + (i % 2 === 0 ? -1 : 1) * (st.length > 12 ? 26 : 0);

  proyek.prasarana.petakJalan.forEach(p => {
    const a = st.findIndex(s => s.kode === p.dari), b = st.findIndex(s => s.kode === p.ke);
    if (a < 0 || b < 0) return;
    const cls = p.jenisJalur === 'Ganda' ? 'track-double' : 'track-single';
    svg.appendChild(mk('line', { x1: X(st[a].km), y1: Y(a), x2: X(st[b].km), y2: Y(b), class: cls }));
    if (p.jenisJalur === 'Ganda')
      svg.appendChild(mk('line', { x1: X(st[a].km), y1: Y(a), x2: X(st[b].km), y2: Y(b), class: 'track-main' }));
  });

  st.forEach((s, i) => {
    const x = X(s.km), y = Y(i), atas = (i % 2 === 0);
    svg.appendChild(mk('circle', { cx: x, cy: y, r: 7,
      class: 'station-node' + (s.jenis === 'Perhentian' ? ' perhentian' : '') }));
    const t1 = mk('text', { x: x, y: y + (atas ? -26 : 34), 'text-anchor': 'middle', class: 'station-label' });
    t1.textContent = s.nama;
    const t2 = mk('text', { x: x, y: y + (atas ? -14 : 46), 'text-anchor': 'middle', class: 'station-code' });
    t2.textContent = s.kode + ' · ' + Number(s.jumlahJalur) + ' jalur';
    const t3 = mk('text', { x: x, y: y + (atas ? 18 : -14), 'text-anchor': 'middle', class: 'station-km' });
    t3.textContent = 'km ' + num(s.km, 1);
    svg.appendChild(t1); svg.appendChild(t2); svg.appendChild(t3);
  });
}

/* ============================================================
   GAPEKA
   ============================================================ */
function gambarGapeka() {
  const m = parseInt($('gp-jam-mulai').value, 10), a = parseInt($('gp-jam-akhir').value, 10);
  TTCGapeka.gambar({
    proyek: proyek, jadwal: proyek.jadwal, konflik: konflik,
    jamMulai: Number.isFinite(m) ? m : 4,
    jamAkhir: Number.isFinite(a) && a > m ? a : 24,
    tinggiGrafik: 780,
    onPilihKA: (nomor) => {
      $('gp-info').textContent = nomor ? 'KA ' + nomor + ' disorot.' : 'Klik garis KA untuk menyorot.';
      if (nomor) { kaTerpilih = nomor; renderDaftarWaktu(); }
      gambarGapeka();
    }
  });
}

/* ============================================================
   SIMULASI
   ============================================================ */
function siapkanSimulasi() {
  const asli = { label: 'gapeka-label', graf: 'gapeka-graf' };
  // gambar ke elemen simulasi dengan menukar id sementara
  const l = $('gapeka-label'), g = $('gapeka-graf');
  const sl = $('sim-label'), sg = $('sim-graf');
  if (!sl || !sg) return;
  const simpanL = l ? l.id : null, simpanG = g ? g.id : null;
  if (l) l.id = 'x-label'; if (g) g.id = 'x-graf';
  sl.id = 'gapeka-label'; sg.id = 'gapeka-graf';
  TTCGapeka.gambar({ proyek: proyek, jadwal: proyek.jadwal, konflik: konflik,
    jamMulai: 4, jamAkhir: 24, tinggiGrafik: 340 });
  sl.id = 'sim-label'; sg.id = 'sim-graf';
  if (l) l.id = simpanL; if (g) g.id = simpanG;
  perbaruiSim();
}

function denganGrafSim(fn) {
  const l = $('gapeka-label'), g = $('gapeka-graf');
  const sl = $('sim-label'), sg = $('sim-graf');
  if (!sl || !sg) return null;
  const sL = l ? l.id : null, sG = g ? g.id : null;
  if (l) l.id = 'x-label'; if (g) g.id = 'x-graf';
  sl.id = 'gapeka-label'; sg.id = 'gapeka-graf';
  const hasil = fn();
  sl.id = 'sim-label'; sg.id = 'sim-graf';
  if (l) l.id = sL; if (g) g.id = sG;
  return hasil;
}

function perbaruiSim() {
  $('sim-jam').textContent = jam(sim.t, true).replace('⁺', '');
  $('sim-slider').value = Math.min(86400, Math.max(0, sim.t));
  const aktif = denganGrafSim(() => TTCGapeka.gambarPosisi(sim.t)) || [];
  // ikuti kursor waktu agar selalu terlihat
  const sc = $('sim-scroll');
  if (sc) {
    const x = ((sim.t / 3600) - 4) * TTCGapeka.G.pxPerJam;
    const tengah = x - sc.clientWidth / 2;
    if (Math.abs(sc.scrollLeft - tengah) > 40) sc.scrollLeft = Math.max(0, tengah);
  }
  $('sim-jml').textContent = aktif.length;
  aktif.sort((a, b) => a.km - b.km);
  $('tabel-sim').innerHTML = aktif.slice(0, 200).map(x =>
    '<tr><td><b>' + esc(x.nomor) + '</b></td>' +
    '<td><span class="pill ' + esc(x.arah) + '">' + esc(x.arah) + '</span></td>' +
    '<td class="num">' + num(x.km, 1) + '</td>' +
    '<td>' + (x.berhenti ? 'Berhenti di stasiun' : 'Berjalan') + '</td></tr>').join('');
}

function langkahSim(ts) {
  if (!sim.jalan) return;
  if (!sim.terakhir) sim.terakhir = ts;
  const dt = (ts - sim.terakhir) / 1000;
  sim.terakhir = ts;
  sim.t += dt * sim.kecepatan;
  if (sim.t > 86400) { sim.t = 86400; sim.jalan = false; }
  perbaruiSim();
  if (sim.jalan) sim.raf = requestAnimationFrame(langkahSim);
}

/* ============================================================
   PARAMETER
   ============================================================ */
function renderParameter() {
  const p = proyek.parameter;
  $('par-dwell').value = p.dwellDefault;
  $('par-dwell-ujung').value = p.dwellUjung;
  $('par-wt').value = p.wtPersen;
  $('par-headway').value = p.headwayMinimum;
  $('par-jalur-bebas').value = p.waktuJalurBebas;
}
function bacaParameter() {
  const p = proyek.parameter;
  p.dwellDefault = Number($('par-dwell').value) || 0;
  p.dwellUjung = Number($('par-dwell-ujung').value) || 0;
  p.wtPersen = Number($('par-wt').value) || 0;
  p.headwayMinimum = Number($('par-headway').value) || 180;
  p.waktuJalurBebas = Number($('par-jalur-bebas').value) || 0;
  simpanOtomatis();
}

/* ============================================================
   BERKAS
   ============================================================ */
function simpanBerkas() {
  const nama = (proyek.namaProyek || 'proyek-ttc').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-');
  TTCEkspor.unduh(nama + '.json', JSON.stringify(proyek, null, 2), 'application/json');
  toast('Berkas proyek diunduh.');
}
function bukaBerkas(ev) {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      proyek = TTCModel.migrasi(JSON.parse(r.result));
      konflik = []; kaTerpilih = null;
      peringatan(''); renderSemua(); pindahView('beranda');
      toast('Proyek "' + proyek.namaProyek + '" dimuat.');
    } catch (e) { peringatan('Berkas gagal dibaca: ' + e.message); }
  };
  r.readAsText(f);
  ev.target.value = '';
}

/* ============================================================
   PILIHAN & MODAL
   ============================================================ */
function isiPilihanStasiun(sel, kosong) {
  const v = sel.value;
  sel.innerHTML = (kosong ? '<option value="">—</option>' : '') +
    proyek.prasarana.stasiun.map(s => '<option value="' + esc(s.kode) + '">' + esc(s.kode) + ' — ' + esc(s.nama) + '</option>').join('');
  if (v) sel.value = v;
}
function isiSemuaPilihan() {
  ['uji-dari', 'uji-ke'].forEach(id => isiPilihanStasiun($(id)));
  const us = $('uji-sarana'); const v = us.value;
  us.innerHTML = proyek.sarana.map(s => '<option value="' + esc(s.id) + '">' + esc(s.nama) + '</option>').join('');
  if (v) us.value = v;
  const st = proyek.prasarana.stasiun;
  if (st.length > 1 && $('uji-dari').value === $('uji-ke').value) {
    $('uji-dari').value = st[0].kode;
    $('uji-ke').value = st[1].kode;
  }
}
function buka(id) { $(id).classList.remove('hidden'); }
function tutup(id) { $(id).classList.add('hidden'); }

/* ============================================================
   PASANG PERISTIWA
   ============================================================ */
function pasang() {
  $$('.nav-item[data-view]').forEach(b => b.onclick = () => pindahView(b.dataset.view));

  $('btn-baru').onclick = () => {
    if (!confirm('Mulai proyek baru? Data yang belum disimpan akan hilang.')) return;
    proyek = TTCModel.proyekKosong(); proyek.sarana = TTCModel.saranaBawaan();
    konflik = []; kaTerpilih = null; peringatan(''); renderSemua(); pindahView('beranda');
    toast('Proyek baru dibuat.');
  };
  $('btn-contoh').onclick = () => {
    proyek = TTCModel.contohProyek(); konflik = []; kaTerpilih = null;
    peringatan(''); renderSemua(); pindahView('beranda');
    toast('Contoh lintas Bogor–Jakarta Kota dimuat.');
  };
  $('btn-simpan').onclick = simpanBerkas;
  $('file-buka').onchange = bukaBerkas;
  $('btn-buat-jadwal').onclick = buatJadwal;
  $('btn-periksa-konflik').onclick = periksaKonflik;
  $('btn-konflik-ulang').onclick = periksaKonflik;

  $('nama-proyek').oninput = e => { proyek.namaProyek = e.target.value; renderHitungan(); simpanOtomatis(); };

  $('btn-tambah-stasiun').onclick = () => bukaModalStasiun(null);
  $('btn-urut-stasiun').onclick = () => { TTCModel.urutkanStasiun(proyek); renderSemua(); toast('Stasiun diurutkan menurut km.'); };
  $('form-stasiun').onsubmit = simpanStasiun;

  $('btn-tambah-petak').onclick = () => bukaModalPetak(null);
  $('btn-petak-otomatis').onclick = petakOtomatis;
  $('form-petak').onsubmit = simpanPetak;

  $('btn-tambah-sarana').onclick = () => bukaModalSarana(null);
  $('btn-sarana-bawaan').onclick = () => {
    const ada = new Set(proyek.sarana.map(s => s.id));
    TTCModel.saranaBawaan().forEach(s => { if (!ada.has(s.id)) proyek.sarana.push(s); });
    renderSemua(); toast('Sarana bawaan dimuat.');
  };
  $('form-sarana').onsubmit = simpanSarana;
  $('btn-uji-hitung').onclick = ujiHitung;

  $('btn-tambah-pola').onclick = () => bukaModalPola(null);
  $('form-pola').onsubmit = simpanPola;
  $('po-berhenti-semua').onchange = e => $('po-pilih-wrap').classList.toggle('hidden', e.target.value === '1');

  $('emp-stasiun').onchange = e => { empKode = e.target.value; renderEmplasemen(); };
  $('btn-emp-terapkan').onclick = terapkanTemplate;
  $('btn-emp-semua').onclick = bangunSemuaEmplasemen;
  $('btn-emp-hapus').onclick = () => {
    const s = TTCModel.cariStasiun(proyek, empKode);
    if (!s || !s.layout) return peringatan('Stasiun ini belum punya layout.');
    if (!confirm('Hapus layout ' + s.kode + '? Stasiun kembali diperiksa dengan hitungan jumlah jalur saja.')) return;
    delete s.layout; renderSemua(); toast('Layout ' + s.kode + ' dihapus.');
  };

  $('btn-tambah-sinyal').onclick = () => bukaModalSinyal(null);
  $('form-sinyal').onsubmit = simpanSinyal;
  $('filter-sinyal-arah').onchange = renderSinyal;
  $('filter-sinyal-jenis').onchange = renderSinyal;
  $('btn-sinyal-otomatis').onclick = () => buka('modal-sgotomatis');
  $('form-sgotomatis').onsubmit = e => {
    e.preventDefault();
    const n = TTCSinyal.buatOtomatis(proyek, {
      jarakBlok: Number($('so-blok').value), jarakMasuk: Number($('so-masuk').value),
      jarakKeluar: Number($('so-keluar').value), aspek: Number($('so-aspek').value)
    });
    simop = null; tutup('modal-sgotomatis'); renderSemua();
    toast(n + ' sinyal dibangun. Ganti nomornya dengan nomor sebenarnya.');
  };
  $('btn-sinyal-muka').onclick = () => {
    const n = TTCSinyal.buatSinyalMuka(proyek, 800);
    renderSemua(); toast(n ? n + ' sinyal muka ditambahkan.' : 'Semua sinyal utama sudah punya sinyal muka.');
  };

  $('btn-ss-play').onclick = () => { siapkanSimSinyal(); if (!simop || ss.jalan) return; ss.jalan = true; ss.terakhir = 0; ss.raf = requestAnimationFrame(langkahSimSinyal); };
  $('btn-ss-pause').onclick = () => { ss.jalan = false; cancelAnimationFrame(ss.raf); };
  $('btn-ss-reset').onclick = resetSimSinyal;
  $('ss-kecepatan').onchange = e => ss.kecepatan = Number(e.target.value);
  $('ss-mulai').onchange = resetSimSinyal;
  $('btn-ss-tahan').onclick = () => {
    if (!simop) return peringatan('Jalankan simulasi dulu.');
    const no = $('ss-tahan-ka').value.trim();
    const m = Number($('ss-tahan-menit').value) || 0;
    if (!no) return peringatan('Isi nomor KA yang akan ditahan.');
    if (simop.tahan(no, m * 60)) toast('KA ' + no + ' ditahan ' + m + ' menit.');
    else peringatan('KA ' + no + ' tidak ditemukan di simulasi.');
  };

  $('btn-blok-bagi').onclick = bagiSemuaBlok;
  $('btn-blok-hitung').onclick = () => { renderBlok(); toast('Kapasitas dihitung ulang.'); };
  $('form-blok').onsubmit = simpanBlok;
  $('bk-tambah').onclick = () => { $('bk-daftar').appendChild(barisBlok('B' + ($('bk-daftar').children.length + 1), 500)); jumlahkanBlok(); };
  $('bk-bagi').onclick = () => {
    const idx = +$('bk-index').value;
    const petak = proyek.prasarana.petakJalan[idx];
    const n = Math.max(1, Math.min(40, parseInt($('bk-jumlah').value, 10) || 1));
    const pj = Math.round(Number(petak.jarak) * 1000 / n);
    $('bk-daftar').innerHTML = '';
    for (let i = 0; i < n; i++) $('bk-daftar').appendChild(barisBlok(petak.dari + '>' + petak.ke + '/B' + (i + 1), pj));
    jumlahkanBlok();
  };
  ['sg-rute','sg-pandang','sg-lepas','sg-vbebas','sg-margin'].forEach(id => $(id).onchange = bacaParameterSinyal);

  $('filter-arah').onchange = renderJadwal;
  $('cari-ka').oninput = renderJadwal;

  $('btn-gp-gambar').onclick = gambarGapeka;
  $('btn-peta-refresh').onclick = gambarPeta;
  $('btn-gp-zoom-in').onclick = () => { TTCGapeka.G.pxPerJam = Math.min(1400, TTCGapeka.G.pxPerJam * 1.4); gambarGapeka(); };
  $('btn-gp-zoom-out').onclick = () => { TTCGapeka.G.pxPerJam = Math.max(70, TTCGapeka.G.pxPerJam / 1.4); gambarGapeka(); };

  ['par-dwell', 'par-dwell-ujung', 'par-wt', 'par-headway', 'par-jalur-bebas']
    .forEach(id => $(id).onchange = bacaParameter);

  $('btn-sim-play').onclick = () => { if (sim.jalan) return; sim.jalan = true; sim.terakhir = 0; sim.raf = requestAnimationFrame(langkahSim); };
  $('btn-sim-pause').onclick = () => { sim.jalan = false; cancelAnimationFrame(sim.raf); };
  $('btn-sim-reset').onclick = () => { sim.jalan = false; cancelAnimationFrame(sim.raf); sim.t = 4 * 3600; perbaruiSim(); };
  $('sim-kecepatan').onchange = e => sim.kecepatan = Number(e.target.value);
  $('sim-slider').oninput = e => { sim.t = Number(e.target.value); perbaruiSim(); };

  $('ek-proyek').onclick = simpanBerkas;
  $('ek-dw').onclick = () => {
    if (!proyek.jadwal.ka.length) return peringatan('Belum ada jadwal.');
    TTCEkspor.unduh('daftar-waktu.csv', '﻿' + TTCEkspor.daftarWaktuCSV(proyek, proyek.jadwal), 'text/csv;charset=utf-8');
    toast('Daftar Waktu diunduh.');
  };
  $('ek-matriks').onclick = () => {
    if (!proyek.jadwal.ka.length) return peringatan('Belum ada jadwal.');
    TTCEkspor.unduh('matriks-jadwal.csv', '﻿' + TTCEkspor.matriksCSV(proyek, proyek.jadwal, ''), 'text/csv;charset=utf-8');
    toast('Matriks jadwal diunduh.');
  };
  $('ek-konflik').onclick = () => {
    if (!konflik.length) return peringatan('Belum ada konflik untuk diekspor.');
    TTCEkspor.unduh('konflik.csv', '﻿' + TTCEkspor.konflikCSV(konflik), 'text/csv;charset=utf-8');
    toast('Daftar konflik diunduh.');
  };
  $('ek-svg').onclick = () => {
    gambarGapeka();
    TTCEkspor.unduhGapekaSVG('gapeka') ? toast('GAPEKA (SVG) diunduh.') : peringatan('Gambar GAPEKA dulu.');
  };
  $('ek-png').onclick = () => {
    gambarGapeka();
    TTCEkspor.unduhGapekaPNG('gapeka', 2).then(ok => ok ? toast('GAPEKA (PNG) diunduh.') : peringatan('Gagal membuat PNG.'));
  };

  $$('[data-close]').forEach(b => b.onclick = () => tutup(b.dataset.close));
  $$('.modal-backdrop').forEach(m => m.onclick = e => { if (e.target === m) m.classList.add('hidden'); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') $$('.modal-backdrop').forEach(m => m.classList.add('hidden'));
  });
}

/* ============================================================
   MULAI
   ============================================================ */
function mulai() {
  pasang();
  if (!muatOtomatis()) { proyek = TTCModel.proyekKosong(); proyek.sarana = TTCModel.saranaBawaan(); }
  renderSemua();
  status('Siap');
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulai);
else mulai();
})();
