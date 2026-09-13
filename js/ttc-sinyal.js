/* ============================================================
   TTC — Sinyal
   Sinyal adalah objek sungguhan: punya nomor, letak km, jenis,
   arah yang dilayani, dan jumlah aspek. Petak blok TIDAK diinput
   sendiri — ia disimpulkan dari sinyal-sinyal yang berurutan.

   Jenis sinyal:
     masuk   — sinyal masuk stasiun (melindungi emplasemen)
     keluar  — sinyal keluar stasiun (mengizinkan masuk petak)
     blok    — sinyal blok antara di lintas bebas
     muka    — sinyal muka / pendahulu, memberi peringatan aspek
               sinyal utama di depannya (tidak membatasi blok)
     langsir — sinyal langsir (tidak membatasi blok)

   Arah:
     hilir — melayani perjalanan ke arah km bertambah
     hulu  — melayani perjalanan ke arah km berkurang
   ============================================================ */
(function (global) {
'use strict';

const JENIS = ['masuk', 'keluar', 'blok', 'muka', 'langsir'];
const JENIS_UTAMA = ['masuk', 'keluar', 'blok'];   // hanya ini yang membatasi blok
const NAMA_JENIS = {
  masuk: 'Sinyal masuk', keluar: 'Sinyal keluar', blok: 'Sinyal blok antara',
  muka: 'Sinyal muka', langsir: 'Sinyal langsir'
};

/* ---------- daftar & urutan ---------- */
function semua(proyek) { return proyek.prasarana.sinyal || (proyek.prasarana.sinyal = []); }

/** Sinyal utama satu arah, terurut menurut arah perjalanan. */
function utama(proyek, arah) {
  const d = semua(proyek).filter(s => s.arah === arah && JENIS_UTAMA.indexOf(s.jenis) >= 0);
  d.sort((a, b) => arah === 'hilir' ? a.km - b.km : b.km - a.km);
  return d;
}

/** Sinyal muka yang berpasangan dengan satu sinyal utama. */
function sinyalMuka(proyek, sinyalUtama) {
  return semua(proyek).find(s => s.jenis === 'muka' && s.arah === sinyalUtama.arah &&
    s.melindungi === sinyalUtama.id) || null;
}

/**
 * Petak blok satu arah untuk seluruh lintas.
 * Blok ke-i membentang dari sinyal ke-i sampai sinyal ke-i+1,
 * dan dilindungi oleh sinyal ke-i.
 */
function blokLintas(proyek, arah) {
  const sig = utama(proyek, arah);
  const hasil = [];
  for (let i = 0; i < sig.length - 1; i++) {
    const a = sig[i], b = sig[i + 1];
    const panjang = Math.abs(Number(b.km) - Number(a.km)) * 1000;
    if (panjang < 1) continue;
    hasil.push({
      nama: a.nomor + '→' + b.nomor,
      pelindung: a.id, pelindungNomor: a.nomor,
      berikut: b.id, berikutNomor: b.nomor,
      kmAwal: Number(a.km), kmAkhir: Number(b.km),
      panjang: panjang, arah: arah, urut: hasil.length
    });
  }
  return hasil;
}

/** Blok yang berada di dalam satu petak jalan. */
function blokPetak(proyek, petak, arah) {
  const A = TTCModel.cariStasiun(proyek, petak.dari);
  const B = TTCModel.cariStasiun(proyek, petak.ke);
  if (!A || !B) return [];
  const lo = Math.min(Number(A.km), Number(B.km));
  const hi = Math.max(Number(A.km), Number(B.km));
  const semuaBlok = blokLintas(proyek, arah);
  const dalam = semuaBlok.filter(b => {
    const bl = Math.min(b.kmAwal, b.kmAkhir), bh = Math.max(b.kmAwal, b.kmAkhir);
    return bl >= lo - 0.0005 && bh <= hi + 0.0005;
  });
  // urutkan mengikuti arah perjalanan
  dalam.sort((x, y) => arah === 'hilir' ? x.kmAwal - y.kmAwal : y.kmAwal - x.kmAwal);
  return dalam;
}

function adaSinyal(proyek) { return semua(proyek).length > 0; }

/* ---------- aspek ----------
   3 indikasi : HIJAU / KUNING / MERAH
   4 indikasi : HIJAU / KUNING KEHIJAUAN / KUNING / MERAH
   2 indikasi : HIJAU / MERAH (peringatan lewat sinyal muka)
--------------------------------------------------------------- */
const ASPEK = {
  MERAH:  { kode: 'merah',  label: 'Merah',            warna: '#c0402d', batasKmh: 0 },
  KUNING: { kode: 'kuning', label: 'Kuning',           warna: '#d9a441', batasKmh: null },
  KUHI:   { kode: 'kuhi',   label: 'Kuning kehijauan', warna: '#9bbf3f', batasKmh: null },
  HIJAU:  { kode: 'hijau',  label: 'Hijau',            warna: '#2f9e63', batasKmh: null }
};

/**
 * Aspek satu sinyal berdasarkan okupansi blok.
 * @param blokArah  daftar blok satu arah (hasil blokLintas)
 * @param i         indeks blok yang dilindungi sinyal ini
 * @param terisi    fungsi(indeksBlok) -> true bila blok ditempati KA
 * @param aspekMax  jumlah aspek sinyal (2/3/4)
 */
function aspek(blokArah, i, terisi, aspekMax) {
  const n = blokArah.length;
  const isi = k => (k >= 0 && k < n) ? !!terisi(k) : false;
  if (i >= n) return ASPEK.HIJAU;
  if (isi(i)) return ASPEK.MERAH;
  if (aspekMax <= 2) return ASPEK.HIJAU;
  if (isi(i + 1)) return ASPEK.KUNING;
  if (aspekMax >= 4 && isi(i + 2)) return ASPEK.KUHI;
  return ASPEK.HIJAU;
}

/* ---------- pembuat otomatis ---------- */
/**
 * Bangun sinyal untuk seluruh lintas:
 *  - sinyal masuk & keluar di tiap stasiun, dua arah
 *  - sinyal blok antara tiap ±jarakBlok meter di tiap petak
 * Nomor yang dihasilkan hanya sementara — ganti dengan nomor sebenarnya.
 */
function buatOtomatis(proyek, opsi) {
  opsi = opsi || {};
  const jarakBlok = Number(opsi.jarakBlok) || 1000;      // meter
  const jarakMasuk = (Number(opsi.jarakMasuk) || 400) / 1000;   // km sebelum stasiun
  const jarakKeluar = (Number(opsi.jarakKeluar) || 150) / 1000; // km setelah stasiun
  const aspekBawaan = Number(opsi.aspek) || 3;

  TTCModel.urutkanStasiun(proyek);
  const st = proyek.prasarana.stasiun;
  const daftar = [];
  let no = 0;
  const buat = (o) => { daftar.push(Object.assign({ id: 'sg-' + (++no) + '-' + Date.now().toString(36), aspek: aspekBawaan, melindungi: null }, o)); };

  st.forEach((s, i) => {
    const km = Number(s.km);
    // arah hilir: masuk sebelum stasiun, keluar setelah stasiun
    if (i > 0) buat({ nomor: 'J' + s.kode, km: +(km - jarakMasuk).toFixed(3), arah: 'hilir', jenis: 'masuk', stasiun: s.kode });
    if (i < st.length - 1) buat({ nomor: s.kode + 'K1', km: +(km + jarakKeluar).toFixed(3), arah: 'hilir', jenis: 'keluar', stasiun: s.kode });
    // arah hulu: masuk dari sisi km besar, keluar ke arah km kecil
    if (i < st.length - 1) buat({ nomor: 'J' + s.kode + 'H', km: +(km + jarakMasuk).toFixed(3), arah: 'hulu', jenis: 'masuk', stasiun: s.kode });
    if (i > 0) buat({ nomor: s.kode + 'K2', km: +(km - jarakKeluar).toFixed(3), arah: 'hulu', jenis: 'keluar', stasiun: s.kode });
  });

  // sinyal blok antara di tiap petak
  proyek.prasarana.petakJalan.forEach(p => {
    const A = TTCModel.cariStasiun(proyek, p.dari), B = TTCModel.cariStasiun(proyek, p.ke);
    if (!A || !B) return;
    const lo = Math.min(Number(A.km), Number(B.km)) + jarakKeluar;
    const hi = Math.max(Number(A.km), Number(B.km)) - jarakMasuk;
    const bentang = (hi - lo) * 1000;
    if (bentang <= jarakBlok) return;                 // cukup satu blok, tidak perlu sinyal antara
    const n = Math.max(1, Math.round(bentang / jarakBlok) - 1);
    for (let k = 1; k <= n; k++) {
      const km = +(lo + (hi - lo) * k / (n + 1)).toFixed(3);
      buat({ nomor: p.dari + p.ke + 'B' + k, km: km, arah: 'hilir', jenis: 'blok' });
      buat({ nomor: p.ke + p.dari + 'B' + k, km: km, arah: 'hulu', jenis: 'blok' });
    }
  });

  proyek.prasarana.sinyal = daftar;
  return daftar.length;
}

/** Tambahkan sinyal muka untuk tiap sinyal utama, pada jarak pengereman. */
function buatSinyalMuka(proyek, jarakM) {
  const jarak = (Number(jarakM) || 800) / 1000;
  const tambah = [];
  ['hilir', 'hulu'].forEach(arah => {
    utama(proyek, arah).forEach(s => {
      if (sinyalMuka(proyek, s)) return;
      const km = arah === 'hilir' ? Number(s.km) - jarak : Number(s.km) + jarak;
      tambah.push({
        id: 'sm-' + s.id, nomor: s.nomor + 'M', km: +km.toFixed(3),
        arah: arah, jenis: 'muka', aspek: 2, melindungi: s.id
      });
    });
  });
  proyek.prasarana.sinyal = semua(proyek).concat(tambah);
  return tambah.length;
}

/** Periksa kewajaran letak sinyal. */
function periksaSinyal(proyek) {
  const catatan = [];
  ['hilir', 'hulu'].forEach(arah => {
    const blok = blokLintas(proyek, arah);
    blok.forEach(b => {
      if (b.panjang < 200) catatan.push({ bobot: 'sedang', pesan: 'Blok ' + b.nama + ' (' + arah + ') hanya ' + Math.round(b.panjang) + ' m — terlalu pendek untuk rangkaian panjang.' });
      if (b.panjang > 6000) catatan.push({ bobot: 'sedang', pesan: 'Blok ' + b.nama + ' (' + arah + ') sepanjang ' + (b.panjang / 1000).toFixed(1) + ' km — headway akan sangat longgar.' });
    });
    if (!blok.length) catatan.push({ bobot: 'berat', pesan: 'Arah ' + arah + ' belum punya blok: sinyal utama kurang dari dua.' });
  });
  const nomor = {};
  semua(proyek).forEach(s => {
    if (nomor[s.nomor]) catatan.push({ bobot: 'berat', pesan: 'Nomor sinyal kembar: ' + s.nomor + '.' });
    nomor[s.nomor] = true;
  });
  return catatan;
}

global.TTCSinyal = {
  JENIS, JENIS_UTAMA, NAMA_JENIS, ASPEK,
  semua, utama, sinyalMuka, blokLintas, blokPetak, adaSinyal,
  aspek, buatOtomatis, buatSinyalMuka, periksaSinyal
};
})(window);
