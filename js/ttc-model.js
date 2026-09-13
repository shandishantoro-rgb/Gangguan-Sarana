/* ============================================================
   TTC — Model Data Proyek
   Struktur data tunggal untuk prasarana, sarana, pola operasi,
   jadwal, dan parameter perhitungan.
   ============================================================ */
(function (global) {
'use strict';

const VERSI_DATA = 2;

function proyekKosong() {
  return {
    format: 'TTC-Project',
    versi: VERSI_DATA,
    namaProyek: 'Proyek TTC',
    dibuat: new Date().toISOString(),
    prasarana: { stasiun: [], petakJalan: [], sinyal: [] },
    sarana: [],
    polaOperasi: [],
    jadwal: { ka: [], dibuat: null },
    parameter: {
      dwellDefault: 30,        // detik berhenti di stasiun antara
      dwellUjung: 300,         // detik balik arah di stasiun ujung
      wtPersen: 5,             // waktu tambahan (%) atas waktu tempuh murni
      headwayMinimum: 180,     // detik, jarak antar KA searah
      waktuJalurBebas: 60,     // detik, waktu jalur harus bebas sebelum KA berikut
      langkahIntegrasi: 0.5,   // detik, langkah waktu mesin dinamika

      // --- parameter persinyalan (dipakai perhitungan blocking time) ---
      sinyal: {
        waktuBentukRute: 6,    // detik, pembentukan & penguncian rute
        waktuPandang: 12,      // detik, masinis melihat sinyal muka
        waktuLepas: 3,         // detik, pelepasan blok setelah KA bebas
        kecepatanBebasMin: 20, // km/jam, kecepatan terendah yang dipakai
                               // menghitung waktu pembebasan blok
        margin: 0              // detik, cadangan tambahan per blok
      }
    }
  };
}

/* ---------- sarana bawaan ---------- */
function saranaBawaan() {
  return [
    {
      id: 'krl-12', nama: 'KRL 12 Kereta (SFC/TM)', jenis: 'KRL',
      jumlahKereta: 12, massaKosong: 350, massaPenumpang: 120,
      dayaKontinu: 4000,        // kW pada roda
      percepatan: 0.85,         // m/s^2 pada kecepatan rendah
      perlambatanDinas: 0.95,   // m/s^2 pengereman dinas
      kecepatanMaks: 90,        // km/jam
      davisA: 15.5, davisB: 0.31, davisC: 0.0062,   // N per ton
      panjang: 240              // meter
    },
    {
      id: 'krl-10', nama: 'KRL 10 Kereta', jenis: 'KRL',
      jumlahKereta: 10, massaKosong: 292, massaPenumpang: 100,
      dayaKontinu: 3400, percepatan: 0.90, perlambatanDinas: 0.95,
      kecepatanMaks: 90, davisA: 15.5, davisB: 0.31, davisC: 0.0062, panjang: 200
    },
    {
      id: 'krl-8', nama: 'KRL 8 Kereta', jenis: 'KRL',
      jumlahKereta: 8, massaKosong: 234, massaPenumpang: 80,
      dayaKontinu: 2720, percepatan: 0.95, perlambatanDinas: 0.95,
      kecepatanMaks: 90, davisA: 15.5, davisB: 0.31, davisC: 0.0062, panjang: 160
    },
    {
      id: 'klok-8', nama: 'KA Lokal Lokomotif + 8 Kereta', jenis: 'Lokomotif',
      jumlahKereta: 8, massaKosong: 84 + 8 * 40, massaPenumpang: 60,
      dayaKontinu: 1900, percepatan: 0.35, perlambatanDinas: 0.70,
      kecepatanMaks: 100, davisA: 13.0, davisB: 0.28, davisC: 0.0075, panjang: 180
    }
  ];
}

/* ---------- contoh jaringan: lintas Bogor – Jakarta Kota ---------- */
function contohProyek() {
  const p = proyekKosong();
  p.namaProyek = 'Contoh — Lintas Bogor–Jakarta Kota';
  p.sarana = saranaBawaan();

  const st = [
    ['BOO', 'Bogor',            0.000, 6, 'Stasiun'],
    ['CLL', 'Cilebut',          6.100, 2, 'Stasiun'],
    ['BJD', 'Bojonggede',      10.500, 3, 'Stasiun'],
    ['CTA', 'Citayam',         16.000, 4, 'Stasiun'],
    ['DP',  'Depok',           20.500, 5, 'Stasiun'],
    ['DPB', 'Depok Baru',      22.400, 2, 'Stasiun'],
    ['PNM', 'Pondok Cina',     24.300, 2, 'Stasiun'],
    ['UI',  'Universitas Indonesia', 25.800, 2, 'Stasiun'],
    ['UP',  'Universitas Pancasila', 27.700, 2, 'Stasiun'],
    ['LNA', 'Lenteng Agung',   29.100, 2, 'Stasiun'],
    ['TPO', 'Tanjung Barat',   31.100, 2, 'Stasiun'],
    ['PSM', 'Pasar Minggu',    34.100, 2, 'Stasiun'],
    ['PSMB','Pasar Minggu Baru',35.700,2, 'Stasiun'],
    ['DRN', 'Duren Kalibata',  37.200, 2, 'Stasiun'],
    ['CW',  'Cawang',          38.600, 2, 'Stasiun'],
    ['TEB', 'Tebet',           40.100, 2, 'Stasiun'],
    ['MRI', 'Manggarai',       43.000, 7, 'Stasiun'],
    ['CKI', 'Cikini',          44.800, 2, 'Stasiun'],
    ['GDD', 'Gondangdia',      46.400, 2, 'Stasiun'],
    ['GMR', 'Gambir',          47.600, 4, 'Stasiun'],
    ['JUA', 'Juanda',          48.500, 2, 'Stasiun'],
    ['SW',  'Sawah Besar',     49.300, 2, 'Stasiun'],
    ['MGB', 'Mangga Besar',    50.200, 2, 'Stasiun'],
    ['JAKK','Jakarta Kota',    51.900, 8, 'Stasiun']
  ];
  p.prasarana.stasiun = st.map(([kode, nama, km, jalur, jenis]) => ({
    kode, nama, km, jumlahJalur: jalur, jenis
  }));

  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i], b = st[i + 1];
    p.prasarana.petakJalan.push({
      dari: a[0], ke: b[0],
      jarak: +(b[2] - a[2]).toFixed(3),
      jenisJalur: 'Ganda',
      kecepatanMaks: b[2] < 43 ? 90 : 70,
      gradien: 0,
      radius: 0,
      headwayMin: 0,
      blok: null
    });
  }

  // contoh persinyalan: sinyal masuk/keluar tiap stasiun + sinyal blok antara
  // tiap ±1.200 m. Nomor yang dipakai hanya sementara.
  if (global.TTCSinyal) {
    TTCSinyal.buatOtomatis(p, { jarakBlok: 1200, jarakMasuk: 400, jarakKeluar: 150, aspek: 3 });
  }

  p.polaOperasi = [{
    id: 'pola-1',
    nama: 'CL Bogor — semua berhenti',
    saranaId: 'krl-12',
    dari: 'BOO', ke: 'JAKK',
    duaArah: true,
    jamMulai: '05:00', jamAkhir: '22:00',
    headway: 10,
    nomorAwal: 1000, langkahNomor: 2,
    berhentiSemua: true,
    berhentiDi: [],
    dwell: 30
  }];
  return p;
}

/* ---------- blok sinyal ----------
   Struktur: petak.blok = { hilir:[{nama,panjang}], hulu:[{nama,panjang}] }
   Untuk lintas tunggal kedua arah memakai daftar yang sama.
   Panjang dalam meter, urut dari stasiun 'dari' menuju 'ke' (arah hilir).
------------------------------------------------------------------ */
function bagiBlokRata(petak, panjangTarget) {
  const total = Number(petak.jarak) * 1000;
  if (!(total > 0)) return;
  const n = Math.max(1, Math.round(total / (Number(panjangTarget) || 1500)));
  const pj = +(total / n).toFixed(1);
  const buat = (awalan) => Array.from({ length: n }, (_, i) => ({
    nama: awalan + (i + 1), panjang: pj
  }));
  if (petak.jenisJalur === 'Tunggal') {
    const b = buat(petak.dari + '-' + petak.ke + '/B');
    petak.blok = { hilir: b, hulu: b.map(x => ({ ...x })).reverse() };
  } else {
    petak.blok = { hilir: buat(petak.dari + '>' + petak.ke + '/B'),
                   hulu:  buat(petak.ke + '>' + petak.dari + '/B') };
  }
}
function jumlahBlok(petak, arah) {
  if (!petak.blok) return 0;
  const d = petak.blok[arah || 'hilir'];
  return Array.isArray(d) ? d.length : 0;
}
function adaBlok(proyek) {
  return proyek.prasarana.petakJalan.some(p => jumlahBlok(p, 'hilir') > 0);
}

/* ---------- migrasi berkas lama (versi 1) ---------- */
function migrasi(data) {
  if (!data || typeof data !== 'object') throw new Error('Berkas bukan proyek TTC.');
  if (data.format !== 'TTC-Project') throw new Error('Format berkas tidak dikenal.');

  const p = proyekKosong();
  p.namaProyek = data.namaProyek || p.namaProyek;
  p.dibuat = data.dibuat || p.dibuat;

  if (Array.isArray(data.stasiun)) {            // versi 1
    p.prasarana.stasiun = data.stasiun;
    p.prasarana.petakJalan = (data.petakJalan || []).map(x => ({
      gradien: 0, radius: 0, headwayMin: 0, blok: null, ...x
    }));
  } else if (data.prasarana) {                  // versi 2
    p.prasarana.sinyal = Array.isArray(data.prasarana.sinyal) ? data.prasarana.sinyal : [];
    p.prasarana.stasiun = data.prasarana.stasiun || [];
    p.prasarana.petakJalan = (data.prasarana.petakJalan || []).map(x => ({
      gradien: 0, radius: 0, headwayMin: 0, blok: null, ...x
    }));
  }
  p.sarana      = Array.isArray(data.sarana) && data.sarana.length ? data.sarana : saranaBawaan();
  p.polaOperasi = Array.isArray(data.polaOperasi) ? data.polaOperasi : [];
  p.jadwal      = data.jadwal && Array.isArray(data.jadwal.ka) ? data.jadwal : { ka: [], dibuat: null };
  const sinyalBawaan = p.parameter.sinyal;
  p.parameter = Object.assign(p.parameter, data.parameter || {});
  p.parameter.sinyal = Object.assign({}, sinyalBawaan, (data.parameter || {}).sinyal || {});
  return p;
}

/* ---------- utilitas jaringan ---------- */
function urutkanStasiun(p) {
  p.prasarana.stasiun.sort((a, b) => Number(a.km) - Number(b.km) ||
    String(a.kode).localeCompare(String(b.kode), 'id'));
}
function cariStasiun(p, kode) {
  return p.prasarana.stasiun.find(s => s.kode === kode) || null;
}
function cariSarana(p, id) {
  return p.sarana.find(s => s.id === id) || null;
}
/* petak antara dua stasiun, arah bebas */
function cariPetak(p, a, b) {
  return p.prasarana.petakJalan.find(x =>
    (x.dari === a && x.ke === b) || (x.dari === b && x.ke === a)) || null;
}
/* daftar stasiun berurutan dari A ke B mengikuti km */
function lintasan(p, dari, ke) {
  urutkanStasiun(p);
  const daftar = p.prasarana.stasiun;
  const i = daftar.findIndex(s => s.kode === dari);
  const j = daftar.findIndex(s => s.kode === ke);
  if (i < 0 || j < 0) return [];
  return i <= j ? daftar.slice(i, j + 1) : daftar.slice(j, i + 1).reverse();
}

global.TTCModel = {
  VERSI_DATA, proyekKosong, saranaBawaan, contohProyek, migrasi,
  urutkanStasiun, cariStasiun, cariSarana, cariPetak, lintasan,
  bagiBlokRata, jumlahBlok, adaBlok
};
})(window);
