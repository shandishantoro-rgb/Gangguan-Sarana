/* ============================================================
   TTC — Emplasemen Stasiun
   Stasiun berhenti menjadi satu titik dan menjadi kumpulan
   ELEMEN yang saling terhubung.

     Elemen  : bagian terkecil yang bisa diduduki satu KA —
               jalur (sepur) dan kaki wesel.
     Wesel   : menghubungkan elemen; punya kecepatan belok.
     Rute    : urutan elemen dari sinyal masuk sampai jalur
               tujuan, atau dari jalur menuju sinyal keluar.

   Aturan pokok persinyalan: dua rute tidak boleh terkunci
   bersamaan bila berbagi satu elemen pun.

   Tata letak tangga (ladder) yang dipakai template:
     WB1 belok → Jalur 2, lurus → WB2
     WB2 belok → Jalur 3, lurus → WB3
     ...
     WB(n-1) belok → Jalur n, lurus → Jalur 1
   Sehingga Jalur 1 adalah sepur lurus, dan rute ke jalur
   bernomor besar melewati lebih banyak wesel.
   ============================================================ */
(function (global) {
'use strict';

const TIPE_WESEL = {
  '1:8':  { kecepatanBelok: 25 },
  '1:9':  { kecepatanBelok: 30 },
  '1:10': { kecepatanBelok: 35 },
  '1:12': { kecepatanBelok: 45 },
  '1:14': { kecepatanBelok: 55 },
  '1:18': { kecepatanBelok: 70 }
};

/* ---------- template emplasemen ---------- */
const TEMPLATE = {
  perhentian: { nama: 'Perhentian — 1 jalur lurus', jalur: 1, peron: [1], badug: 0 },
  j2:         { nama: '2 jalur — silang sederhana', jalur: 2, peron: [1, 2], badug: 0 },
  j3:         { nama: '3 jalur — 1 lurus, 2 belok', jalur: 3, peron: [1, 2, 3], badug: 0 },
  j4:         { nama: '4 jalur — dua peron pulau', jalur: 4, peron: [1, 2, 3, 4], badug: 0 },
  j5:         { nama: '5 jalur', jalur: 5, peron: [1, 2, 3, 4], badug: 1 },
  j6:         { nama: '6 jalur — stasiun besar', jalur: 6, peron: [1, 2, 3, 4, 5], badug: 1 }
};

function buatLayout(kunciTemplate, opsi) {
  opsi = opsi || {};
  const t = TEMPLATE[kunciTemplate] || TEMPLATE.j2;
  const n = t.jalur;
  const ganda = opsi.ganda !== false;          // lintas ganda: dua kelompok jalur terpisah
  const panjang = Number(opsi.panjangEfektif) || 250;
  const tipeWesel = opsi.tipeWesel || '1:12';
  const vBelok = (TIPE_WESEL[tipeWesel] || TIPE_WESEL['1:12']).kecepatanBelok;

  /* ---- jalur ----
     Lintas ganda: jalur ganjil melayani hilir, genap melayani hulu.
     Lintas tunggal: seluruh jalur dipakai dua arah. */
  const jalur = [];
  for (let k = 1; k <= n; k++) {
    const badug = (t.badug && k > n - t.badug);
    jalur.push({
      no: String(k),
      nama: badug ? 'Sepur badug ' + k : 'Jalur ' + k,
      panjangEfektif: badug ? Math.round(panjang * 0.7) : panjang,
      peron: t.peron.indexOf(k) >= 0 && !badug,
      arahLazim: (!ganda || n === 1) ? 'dua' : (k % 2 === 1 ? 'hilir' : 'hulu'),
      badug: !!badug
    });
  }

  /* ---- kelompok jalur per arah ----
     Tiap kelompok punya tangga weselnya sendiri, sehingga
     perjalanan hilir dan hulu di stasiun lintas ganda tidak
     saling mengunci wesel — sebagaimana di lapangan. */
  const kelompok = kelompokJalur(jalur, ganda);

  const wesel = [];
  Object.keys(kelompok).forEach(g => {
    const isi = kelompok[g];
    const tanda = g === 'dua' ? '' : (g === 'hilir' ? 'H' : 'U');
    for (let k = 1; k < isi.length; k++) {
      wesel.push({ no: 'WB' + tanda + k, sisi: 'barat', kelompok: g, tipe: tipeWesel, kecepatanBelok: vBelok, keJalur: isi[k].no });
      wesel.push({ no: 'WT' + tanda + k, sisi: 'timur', kelompok: g, tipe: tipeWesel, kecepatanBelok: vBelok, keJalur: isi[k].no });
    }
  });

  const layout = { template: kunciTemplate, ganda: ganda, jalur, wesel, rute: [] };
  layout.rute = buatRute(layout, opsi.kecepatanLurus || 60);
  return layout;
}

/** Bagi jalur menjadi kelompok per arah; jalur pertama tiap kelompok = sepur lurus. */
function kelompokJalur(jalur, ganda) {
  const pakai = jalur.filter(j => !j.badug);
  if (!ganda) return { dua: pakai };
  const hilir = pakai.filter(j => j.arahLazim === 'hilir' || j.arahLazim === 'dua');
  const hulu = pakai.filter(j => j.arahLazim === 'hulu' || j.arahLazim === 'dua');
  const k = {};
  if (hilir.length) k.hilir = hilir;
  if (hulu.length) k.hulu = hulu;
  return k;
}

/**
 * Bangun seluruh rute.
 * Sisi barat = km kecil, sisi timur = km besar.
 * Arah hilir masuk dari barat dan keluar ke timur; hulu sebaliknya.
 * Di dalam satu kelompok, rute ke jalur ke-i melewati wesel 1..i
 * dan membelok di wesel ke-i; rute ke sepur lurus melewati semuanya.
 */
function buatRute(layout, kecepatanLurus) {
  const rute = [];
  const kelompok = kelompokJalur(layout.jalur, layout.ganda !== false);
  const vLurus = Number(kecepatanLurus) || 60;

  Object.keys(kelompok).forEach(g => {
    const isi = kelompok[g];
    const weselSisi = sisi => layout.wesel
      .filter(w => w.sisi === sisi && (w.kelompok || 'dua') === g)
      .sort((a, b) => Number(a.no.replace(/\D/g, '')) - Number(b.no.replace(/\D/g, '')));

    const jalanKe = (sisi, i) => {                 // i = indeks dalam kelompok, 0 = sepur lurus
      const w = weselSisi(sisi);
      if (!w.length) return { elemen: [], belok: null };
      if (i === 0) return { elemen: w.map(x => x.no), belok: null };
      const dipakai = w.slice(0, i);
      return { elemen: dipakai.map(x => x.no), belok: dipakai[dipakai.length - 1] };
    };

    const arahDilayani = g === 'dua' ? ['hilir', 'hulu'] : [g];
    isi.forEach((j, i) => {
      arahDilayani.forEach(arah => {
        const sMasuk = arah === 'hilir' ? 'barat' : 'timur';
        const sKeluar = arah === 'hilir' ? 'timur' : 'barat';
        const m = jalanKe(sMasuk, i);
        rute.push({
          id: 'R-' + arah + '-masuk-' + j.no,
          nama: 'Masuk ' + arah + ' → ' + j.nama,
          jenis: 'masuk', arah: arah, jalur: j.no,
          elemen: m.elemen.concat(['J' + j.no]),
          kecepatan: m.belok ? Number(m.belok.kecepatanBelok) : vLurus
        });
        const x = jalanKe(sKeluar, i);
        rute.push({
          id: 'R-' + arah + '-keluar-' + j.no,
          nama: j.nama + ' → keluar ' + arah,
          jenis: 'keluar', arah: arah, jalur: j.no,
          elemen: ['J' + j.no].concat(x.elemen),
          kecepatan: x.belok ? Number(x.belok.kecepatanBelok) : vLurus
        });
      });
    });
  });
  return rute;
}

/* ---------- pencarian ---------- */
function layoutStasiun(proyek, kode) {
  const s = TTCModel.cariStasiun(proyek, kode);
  return (s && s.layout) ? s.layout : null;
}
function cariRute(layout, jenis, arah, jalur) {
  return layout.rute.find(r => r.jenis === jenis && r.arah === arah && r.jalur === String(jalur)) || null;
}
/** Dua rute bentrok bila berbagi minimal satu elemen. */
function ruteBentrok(a, b) {
  if (!a || !b) return null;
  const set = new Set(a.elemen);
  const sama = b.elemen.filter(e => set.has(e));
  return sama.length ? sama : null;
}

/* ---------- penugasan jalur ----------
   Untuk tiap stasiun, tiap KA yang lewat atau berhenti diberi
   jalur. Dipilih jalur yang: cukup panjang, sesuai arah lazim,
   berperon bila KA berhenti, dan sedang bebas.
------------------------------------------------------------------ */
function tugaskanJalur(proyek) {
  const par = proyek.parameter || {};
  const bebas = Number(par.waktuJalurBebas) || 60;
  const kunci = Number((par.sinyal || {}).waktuBentukRute) || 6;
  const temuan = [];
  const pakai = {};   // kode stasiun -> { noJalur: [{masuk,keluar,nomor}] }
  const muatDilapor = {};   // agar keluhan panjang rangkaian tidak berulang tiap KA

  const kejadian = [];
  (proyek.jadwal.ka || []).forEach(k => {
    const sarana = TTCModel.cariSarana(proyek, k.saranaId);
    k.perjalanan.forEach((t, i) => {
      const masuk = (t.datang != null ? t.datang : t.berangkat);
      const keluar = (t.berangkat != null ? t.berangkat : t.datang);
      if (masuk == null) return;
      kejadian.push({
        kode: t.kode, nomor: k.nomor, arah: k.arah, titik: t,
        masuk, keluar, berhenti: !!t.berhenti,
        panjang: sarana ? (Number(sarana.panjang) || 200) : 200
      });
    });
  });
  kejadian.sort((a, b) => a.masuk - b.masuk);

  kejadian.forEach(e => {
    const layout = layoutStasiun(proyek, e.kode);
    if (!layout) { e.titik.jalur = null; return; }     // stasiun belum digambar
    pakai[e.kode] = pakai[e.kode] || {};
    const isi = pakai[e.kode];

    const muat = j => !Number(j.panjangEfektif) || Number(j.panjangEfektif) >= e.panjang;
    const arahOK = j => j.arahLazim === 'dua' || j.arahLazim === e.arah;
    const luang = j => {
      const d = isi[j.no] || [];
      return !d.some(x => e.masuk - kunci < x.keluar + bebas && x.masuk - kunci < e.keluar + bebas);
    };

    let calon = layout.jalur.filter(j => !j.badug && muat(j) && arahOK(j) && luang(j));
    if (e.berhenti) {
      const berperon = calon.filter(j => j.peron);
      if (berperon.length) calon = berperon;
    }
    if (!calon.length) calon = layout.jalur.filter(j => !j.badug && muat(j) && luang(j));

    if (!calon.length) {
      e.titik.jalur = null;
      const takMuat = !layout.jalur.some(j => !j.badug && muat(j));
      if (takMuat) {
        // satu keluhan per stasiun per panjang rangkaian, bukan per perjalanan
        const kunciLapor = e.kode + '|' + e.panjang;
        if (!muatDilapor[kunciLapor]) {
          const terpanjang = Math.max.apply(null, layout.jalur.filter(j => !j.badug).map(j => Number(j.panjangEfektif) || 0));
          muatDilapor[kunciLapor] = true;
          temuan.push({
            jenis: 'Rangkaian tidak muat di jalur', bobot: 'berat',
            lokasi: e.kode, ka: [e.nomor], waktu: e.masuk,
            pesan: 'Di ' + e.kode + ', rangkaian sepanjang ' + e.panjang + ' m tidak muat di jalur mana pun ' +
                   '(jalur terpanjang ' + terpanjang + ' m). Contoh KA ' + e.nomor + '.'
          });
        }
      } else {
        temuan.push({
          jenis: 'Tidak ada jalur tersedia', bobot: 'berat',
          lokasi: e.kode, ka: [e.nomor], waktu: e.masuk,
          pesan: 'Di ' + e.kode + ' tidak ada jalur yang bebas untuk KA ' + e.nomor + ' pada ' + TTCJadwal.detikKeJam(e.masuk) + '.'
        });
      }
      return;
    }

    calon.sort((a, b) => (Number(a.no) - Number(b.no)));
    const pilih = calon[0];
    e.titik.jalur = pilih.no;
    (isi[pilih.no] = isi[pilih.no] || []).push({ masuk: e.masuk, keluar: e.keluar, nomor: e.nomor, arah: e.arah, berhenti: e.berhenti });
  });

  return { temuan, kejadian };
}

/* ---------- konflik rute ---------- */
function periksaRute(proyek, kejadian) {
  const par = proyek.parameter || {};
  const sg = par.sinyal || {};
  const kunci = Number(sg.waktuBentukRute) || 6;
  const pandang = Number(sg.waktuPandang) || 12;
  const lepas = Number(sg.waktuLepas) || 3;
  const temuan = [];

  const perStasiun = {};
  kejadian.forEach(e => {
    if (!e.titik.jalur) return;
    (perStasiun[e.kode] = perStasiun[e.kode] || []).push(e);
  });

  Object.keys(perStasiun).forEach(kode => {
    const layout = layoutStasiun(proyek, kode);
    if (!layout) return;
    const isi = perStasiun[kode].sort((a, b) => a.masuk - b.masuk);

    // jendela penguncian tiap rute
    const jendela = [];
    isi.forEach(e => {
      const rMasuk = cariRute(layout, 'masuk', e.arah, e.titik.jalur);
      const rKeluar = cariRute(layout, 'keluar', e.arah, e.titik.jalur);
      if (rMasuk) jendela.push({ rute: rMasuk, nomor: e.nomor, jenis: 'masuk',
        mulai: e.masuk - kunci - pandang, selesai: e.masuk + lepas });
      if (rKeluar) jendela.push({ rute: rKeluar, nomor: e.nomor, jenis: 'keluar',
        mulai: e.keluar - kunci, selesai: e.keluar + lepas + 20 });
    });
    jendela.sort((a, b) => a.mulai - b.mulai);

    for (let i = 0; i < jendela.length; i++) {
      for (let j = i + 1; j < jendela.length; j++) {
        const A = jendela[i], B = jendela[j];
        if (B.mulai >= A.selesai) break;
        if (A.nomor === B.nomor) continue;
        const sama = ruteBentrok(A.rute, B.rute);
        if (!sama) continue;
        temuan.push({
          jenis: 'Rute bentrok di emplasemen', bobot: 'berat',
          lokasi: kode, ka: [A.nomor, B.nomor], waktu: Math.max(A.mulai, B.mulai),
          pesan: 'Di ' + kode + ', rute "' + A.rute.nama + '" (KA ' + A.nomor + ') dan "' +
                 B.rute.nama + '" (KA ' + B.nomor + ') berbagi elemen ' + sama.join(', ') +
                 ' pada waktu yang sama. Kedua rute tidak dapat terkunci bersamaan.'
        });
      }
    }
  });
  return temuan;
}

/** Pemeriksaan lengkap emplasemen: penugasan jalur + konflik rute. */
function periksa(proyek) {
  if (!proyek.jadwal || !proyek.jadwal.ka || !proyek.jadwal.ka.length) return [];
  const ada = proyek.prasarana.stasiun.some(s => s.layout);
  if (!ada) return [];
  const hasil = tugaskanJalur(proyek);
  return hasil.temuan.concat(periksaRute(proyek, hasil.kejadian));
}

function statistik(proyek) {
  const st = proyek.prasarana.stasiun;
  const digambar = st.filter(s => s.layout);
  let jalur = 0, wesel = 0, rute = 0;
  digambar.forEach(s => { jalur += s.layout.jalur.length; wesel += s.layout.wesel.length; rute += s.layout.rute.length; });
  return { total: st.length, digambar: digambar.length, jalur, wesel, rute };
}

global.TTCEmplasemen = {
  TIPE_WESEL, TEMPLATE, buatLayout, buatRute, kelompokJalur, layoutStasiun, cariRute,
  ruteBentrok, tugaskanJalur, periksaRute, periksa, statistik
};
})(window);
