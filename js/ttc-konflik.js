/* ============================================================
   TTC — Deteksi Konflik Perjalanan
   Empat jenis konflik yang diperiksa:
     1. Persilangan di petak jalur tunggal
     2. Penyusulan / kejar-kejaran searah dalam satu petak
     3. Pelanggaran headway minimum di stasiun
     4. Okupansi jalur stasiun melebihi jumlah jalur tersedia
   ============================================================ */
(function (global) {
'use strict';

/** Bangun daftar okupansi petak: siapa menempati petak mana, kapan. */
function okupansiPetak(jadwal) {
  const daftar = [];
  jadwal.ka.forEach(k => {
    const p = k.perjalanan;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1];
      const mulai = (a.berangkat != null ? a.berangkat : a.datang);
      const selesai = (b.datang != null ? b.datang : b.berangkat);
      if (mulai == null || selesai == null) continue;
      daftar.push({
        nomor: k.nomor, arah: k.arah,
        dari: a.kode, ke: b.kode,
        kunci: [a.kode, b.kode].sort().join('|'),
        mulai, selesai
      });
    }
  });
  return daftar;
}

const tumpang = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;

function periksa(proyek, jadwal) {
  const temuan = [];
  if (!jadwal || !jadwal.ka || !jadwal.ka.length) return temuan;

  const par = proyek.parameter || {};
  const headwayGlobal = Number(par.headwayMinimum) || 180;
  const jalurBebas = Number(par.waktuJalurBebas) || 60;

  // Bila blok sinyal sudah didefinisikan, headway minimum dihitung dari
  // blocking time tiap petak — bukan dari satu angka global.
  const pakaiBlok = (typeof TTCBlok !== 'undefined') && TTCModel.adaBlok(proyek);
  const petaHw = pakaiBlok ? TTCBlok.petaHeadway(proyek) : {};
  const hwPetak = kunci => Math.round(petaHw[kunci] || headwayGlobal);

  /* ---- 1 & 2: konflik di petak ---- */
  const okup = okupansiPetak(jadwal);
  const perPetak = {};
  okup.forEach(o => { (perPetak[o.kunci] = perPetak[o.kunci] || []).push(o); });

  Object.keys(perPetak).forEach(kunci => {
    const [a, b] = kunci.split('|');
    const petak = TTCModel.cariPetak(proyek, a, b);
    const tunggal = petak && petak.jenisJalur === 'Tunggal';
    const isi = perPetak[kunci].sort((x, y) => x.mulai - y.mulai);

    const headwayMin = hwPetak(kunci);
    for (let i = 0; i < isi.length; i++) {
      for (let j = i + 1; j < isi.length; j++) {
        const A = isi[i], B = isi[j];
        if (B.mulai >= A.selesai + headwayMin) break;
        const berlawanan = A.arah !== B.arah;

        if (tunggal && berlawanan && tumpang(A.mulai, A.selesai, B.mulai, B.selesai)) {
          temuan.push({
            jenis: 'Persilangan di lintas tunggal', bobot: 'berat',
            lokasi: a + '–' + b, ka: [A.nomor, B.nomor],
            waktu: Math.max(A.mulai, B.mulai),
            pesan: 'KA ' + A.nomor + ' dan KA ' + B.nomor + ' berada di petak jalur tunggal ' +
                   a + '–' + b + ' pada waktu yang sama. Persilangan harus dipindah ke stasiun.'
          });
        } else if (!berlawanan && tumpang(A.mulai, A.selesai, B.mulai, B.selesai)) {
          temuan.push({
            jenis: 'Penyusulan di petak', bobot: 'berat',
            lokasi: a + '–' + b, ka: [A.nomor, B.nomor],
            waktu: Math.max(A.mulai, B.mulai),
            pesan: 'KA ' + B.nomor + ' menyusul KA ' + A.nomor + ' di dalam petak ' + a + '–' + b +
                   '. Penyusulan hanya boleh dilakukan di stasiun berjalur cukup.'
          });
        } else if (!berlawanan && B.mulai - A.mulai < headwayMin) {
          temuan.push({
            jenis: 'Headway kurang di petak', bobot: 'sedang',
            lokasi: a + '–' + b, ka: [A.nomor, B.nomor],
            waktu: B.mulai,
            pesan: 'Selang KA ' + A.nomor + ' dan KA ' + B.nomor + ' di petak ' + a + '–' + b +
                   ' hanya ' + (((B.mulai - A.mulai) / 60).toFixed(1)) + ' menit, di bawah headway minimum ' +
                   ((headwayMin / 60).toFixed(1)) + ' menit' +
                   (pakaiBlok ? ' yang dihitung dari blocking time petak ini.' : ' menurut Parameter.')
          });
        }
      }
    }
  });

  /* ---- 3 & 4: konflik di stasiun ---- */
  const perStasiun = {};
  jadwal.ka.forEach(k => {
    k.perjalanan.forEach(t => {
      const masuk = (t.datang != null ? t.datang : t.berangkat);
      const keluar = (t.berangkat != null ? t.berangkat : t.datang);
      if (masuk == null) return;
      (perStasiun[t.kode] = perStasiun[t.kode] || []).push({
        nomor: k.nomor, arah: k.arah, masuk, keluar: keluar + jalurBebas, berhenti: t.berhenti
      });
    });
  });

  Object.keys(perStasiun).forEach(kode => {
    const st = TTCModel.cariStasiun(proyek, kode);
    const kapasitas = st ? (Number(st.jumlahJalur) || 1) : 1;
    const isi = perStasiun[kode].sort((a, b) => a.masuk - b.masuk);

    // headway searah di stasiun
    const headwayMin = headwayGlobal;
    for (let i = 1; i < isi.length; i++) {
      for (let j = i - 1; j >= 0 && isi[i].masuk - isi[j].masuk < headwayMin; j--) {
        if (isi[i].arah !== isi[j].arah) continue;
        const selang = isi[i].masuk - isi[j].masuk;
        temuan.push({
          jenis: 'Headway kurang di stasiun', bobot: 'sedang',
          lokasi: kode, ka: [isi[j].nomor, isi[i].nomor], waktu: isi[i].masuk,
          pesan: 'Di ' + kode + ', KA ' + isi[i].nomor + ' hanya ' + Math.round(selang / 60) +
                 ' menit di belakang KA ' + isi[j].nomor + ' (minimum ' + Math.round(headwayMin / 60) + ' menit).'
        });
        break;
      }
    }

    // okupansi jalur — sapuan garis waktu
    const acara = [];
    isi.forEach(x => { acara.push([x.masuk, 1, x.nomor]); acara.push([x.keluar, -1, x.nomor]); });
    acara.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let jml = 0; const aktif = new Set();
    acara.forEach(([w, d, nomor]) => {
      if (d === 1) { aktif.add(nomor); jml++; } else { aktif.delete(nomor); jml--; }
      if (d === 1 && jml > kapasitas) {
        temuan.push({
          jenis: 'Jalur stasiun penuh', bobot: 'berat',
          lokasi: kode, ka: [...aktif], waktu: w,
          pesan: 'Stasiun ' + kode + ' hanya punya ' + kapasitas + ' jalur, tetapi ada ' + jml +
                 ' KA bersamaan (' + [...aktif].join(', ') + ').'
        });
      }
    });
  });

  // konflik emplasemen: rute berbagi wesel, jalur penuh, rangkaian tidak muat
  if (typeof TTCEmplasemen !== 'undefined') {
    try { TTCEmplasemen.periksa(proyek).forEach(t => temuan.push(t)); } catch (e) {}
  }

  // buang duplikat & urutkan
  const kunciUnik = new Set();
  const bersih = temuan.filter(t => {
    const k = t.jenis + '|' + t.lokasi + '|' + t.ka.join(',') + '|' + Math.round(t.waktu / 60);
    if (kunciUnik.has(k)) return false;
    kunciUnik.add(k); return true;
  });
  bersih.sort((a, b) => a.waktu - b.waktu);
  return bersih;
}

global.TTCKonflik = { periksa, okupansiPetak };
})(window);
