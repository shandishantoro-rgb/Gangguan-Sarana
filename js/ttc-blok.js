/* ============================================================
   TTC — Sinyal Blok & Blocking Time
   Menghitung headway minimum dari okupansi blok, bukan dari
   angka yang ditetapkan sendiri.

   Teori blocking time (Pachl / Hansen): satu blok tidak hanya
   terpakai selama KA berada di dalamnya. Blok sudah terkunci
   sejak rute dibentuk dan baru lepas setelah seluruh rangkaian
   membebaskannya. Enam komponen:

     1. Pembentukan rute   — rute dikunci sebelum sinyal aman
     2. Waktu pandang      — masinis melihat sinyal muka
     3. Waktu pendekat     — menempuh blok sebelumnya (jarak rem)
     4. Waktu tempuh blok  — melintasi blok itu sendiri
     5. Waktu pembebasan   — panjang rangkaian melewati batas blok
     6. Waktu pelepasan    — blok dilepas kembali

   Headway minimum = blocking time terbesar di antara seluruh
   blok pada petak itu. Blok itulah penentu kapasitas.
   ============================================================ */
(function (global) {
'use strict';

const kunciPetak = (a, b) => [a, b].sort().join('|');

/**
 * Daftar blok satu petak untuk satu arah, lengkap dengan posisi.
 * Bila sinyal sudah didefinisikan, blok DISIMPULKAN dari letak sinyal.
 * Bila belum, dipakai pembagian manual atau satu blok penuh.
 */
function daftarBlok(petak, arah, proyek) {
  const total = Number(petak.jarak) * 1000;

  if (proyek && typeof TTCSinyal !== 'undefined' && TTCSinyal.adaSinyal(proyek)) {
    const dariSinyal = TTCSinyal.blokPetak(proyek, petak, arah);
    if (dariSinyal.length) {
      let s = 0;
      const skala = total / dariSinyal.reduce((a, x) => a + x.panjang, 0);
      return dariSinyal.map(x => {
        const pj = x.panjang * (isFinite(skala) && skala > 0 ? skala : 1);
        const item = { nama: x.nama, panjang: pj, sMulai: s, sSelesai: s + pj,
                       pelindung: x.pelindungNomor, berikut: x.berikutNomor };
        s += pj; return item;
      });
    }
  }

  let d = petak.blok ? petak.blok[arah] : null;
  if (!Array.isArray(d) || !d.length) {
    d = [{ nama: 'blok tunggal', panjang: total }];   // belum dibagi = satu blok penuh
  }
  const jml = d.reduce((s, x) => s + Number(x.panjang || 0), 0);
  const skala = jml > 0 ? total / jml : 1;            // rapikan bila tidak pas
  let s = 0;
  return d.map((b, i) => {
    const pj = Number(b.panjang || 0) * skala;
    const item = { nama: b.nama || ('B' + (i + 1)), panjang: pj, sMulai: s, sSelesai: s + pj };
    s += pj;
    return item;
  });
}

/**
 * Hitung blocking time seluruh blok pada satu petak.
 * @returns {blok[], headwayMin, blokPenentu, waktuTempuh, kurva}
 */
function hitungPetak(proyek, sarana, petak, arah, opsi) {
  opsi = opsi || {};
  const par = (proyek.parameter && proyek.parameter.sinyal) || {};
  const tRute   = Number(par.waktuBentukRute) || 0;
  const tPandang= Number(par.waktuPandang) || 0;
  const tLepas  = Number(par.waktuLepas) || 0;
  const margin  = Number(par.margin) || 0;
  const vBebasMin = (Number(par.kecepatanBebasMin) || 20) / 3.6;  // m/s
  const panjangKA = Number(sarana.panjang) || 200;

  const seg = [{
    panjang: Number(petak.jarak) * 1000,
    vBatas: Number(petak.kecepatanMaks) || 60,
    gradien: (arah === 'hulu' ? -1 : 1) * (Number(petak.gradien) || 0),
    radius: Number(petak.radius) || 0
  }];
  const gerak = TTCDinamika.hitungSegmen(sarana, seg, {
    vAwal: opsi.vAwal || 0, vAkhir: opsi.vAkhir || 0
  });
  const kurva = gerak.kurva;

  const blok = daftarBlok(petak, arah, proyek).map((b, i, arr) => {
    const tMasuk = TTCDinamika.waktuPadaJarak(kurva, b.sMulai);
    const tKeluar = TTCDinamika.waktuPadaJarak(kurva, b.sSelesai);
    const vKeluar = Math.max(TTCDinamika.kecepatanPadaJarak(kurva, b.sSelesai), 1);
    const tempuh = tKeluar - tMasuk;

    // waktu pendekat = menempuh blok sebelumnya; untuk blok pertama
    // dipakai jarak pengereman dari kecepatan masuk sebagai penggantinya
    let pendekat;
    if (i > 0) {
      const s = arr[i - 1];
      pendekat = TTCDinamika.waktuPadaJarak(kurva, s.sSelesai) - TTCDinamika.waktuPadaJarak(kurva, s.sMulai);
    } else {
      const vMasuk = Math.max(TTCDinamika.kecepatanPadaJarak(kurva, 0), 1);
      const b2 = Number(sarana.perlambatanDinas) || 0.9;
      pendekat = vMasuk / b2;                       // setara waktu mengerem sampai berhenti
    }

    // Waktu pembebasan: seluruh rangkaian harus melewati batas blok.
    // Bila ekor masih berada di dalam petak, dihitung dari kurva gerak;
    // bila melewati batas petak (KA berhenti di stasiun), dipakai kecepatan
    // pembebasan minimum agar angkanya tidak melonjak saat kecepatan -> 0.
    const sEkor = b.sSelesai + panjangKA;
    let bebas;
    if (sEkor <= kurva.panjang - 1) {
      bebas = TTCDinamika.waktuPadaJarak(kurva, sEkor) - tKeluar;
    } else {
      bebas = panjangKA / Math.max(vKeluar, vBebasMin);
    }
    bebas = Math.min(bebas, panjangKA / vBebasMin);
    const total = tRute + tPandang + pendekat + tempuh + bebas + tLepas + margin;

    return {
      nama: b.nama, panjang: b.panjang,
      sMulai: b.sMulai, sSelesai: b.sSelesai,
      tMasuk, tKeluar, vKeluar: vKeluar * 3.6,
      rincian: { rute: tRute, pandang: tPandang, pendekat, tempuh, bebas, lepas: tLepas, margin },
      blocking: total
    };
  });

  let penentu = null;
  blok.forEach(b => { if (!penentu || b.blocking > penentu.blocking) penentu = b; });

  return {
    blok,
    headwayMin: penentu ? penentu.blocking : 0,
    blokPenentu: penentu ? penentu.nama : '—',
    waktuTempuh: gerak.waktu,
    jarak: Number(petak.jarak),
    vMaks: gerak.vMaks
  };
}

/** Sarana mana yang benar-benar dipakai di lintas (dari pola operasi). */
function saranaDipakai(proyek) {
  const id = new Set((proyek.polaOperasi || []).map(p => p.saranaId));
  const hasil = proyek.sarana.filter(s => id.has(s.id));
  return hasil.length ? hasil : proyek.sarana.slice(0, 1);
}

/**
 * Tabel headway minimum seluruh petak — inilah peta kapasitas lintas.
 * Untuk tiap petak diambil nilai terburuk dari seluruh sarana yang dipakai.
 */
function tabelHeadway(proyek) {
  const list = saranaDipakai(proyek);
  if (!list.length) return [];
  return proyek.prasarana.petakJalan.map(petak => {
    let hilir = 0, hulu = 0, penentu = '—', vm = 0, tempuh = 0;
    const nBlok = daftarBlok(petak, 'hilir', proyek).length;
    list.forEach(sr => {
      const h = hitungPetak(proyek, sr, petak, 'hilir', {});
      const u = hitungPetak(proyek, sr, petak, 'hulu', {});
      if (h.headwayMin > hilir) { hilir = h.headwayMin; penentu = h.blokPenentu; vm = h.vMaks; tempuh = h.waktuTempuh; }
      if (u.headwayMin > hulu) hulu = u.headwayMin;
    });
    const maks = Math.max(hilir, hulu);
    return {
      kunci: kunciPetak(petak.dari, petak.ke),
      dari: petak.dari, ke: petak.ke,
      jarak: Number(petak.jarak),
      jenisJalur: petak.jenisJalur,
      jumlahBlok: nBlok,
      panjangBlokRata: (Number(petak.jarak) * 1000) / Math.max(1, nBlok),
      headwayHilir: hilir, headwayHulu: hulu, headwayMaks: maks,
      kapasitas: maks > 0 ? Math.floor(3600 / maks) : 0,
      blokPenentu: penentu, vMaks: vm, waktuTempuh: tempuh
    };
  });
}

/** Peta cepat: kunci petak -> headway minimum (detik). */
function petaHeadway(proyek) {
  const peta = {};
  tabelHeadway(proyek).forEach(r => { peta[r.kunci] = r.headwayMaks; });
  return peta;
}

/** Petak paling sempit — penentu kapasitas seluruh lintas. */
function bottleneck(tabel) {
  let b = null;
  tabel.forEach(r => { if (!b || r.headwayMaks > b.headwayMaks) b = r; });
  return b;
}

global.TTCBlok = { hitungPetak, tabelHeadway, petaHeadway, bottleneck, daftarBlok, kunciPetak, saranaDipakai };
})(window);
