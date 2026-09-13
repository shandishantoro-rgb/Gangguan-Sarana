/* ============================================================
   TTC — Generator Jadwal & Daftar Waktu
   Mengubah pola operasi (relasi, jam operasi, headway) menjadi
   daftar KA lengkap dengan jam datang dan berangkat tiap stasiun.
   Semua waktu disimpan sebagai detik sejak 00:00.
   ============================================================ */
(function (global) {
'use strict';

const HARI = 86400;

function jamKeDetik(t) {
  const m = String(t || '').match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  return (+m[1]) * 3600 + (+m[2]) * 60 + (+(m[3] || 0));
}
function detikKeJam(d, denganDetik) {
  d = Math.round(d);
  const lewat = d >= HARI;
  d = ((d % HARI) + HARI) % HARI;
  const h = Math.floor(d / 3600), m = Math.floor((d % 3600) / 60), s = d % 60;
  const p = n => String(n).padStart(2, '0');
  return p(h) + ':' + p(m) + (denganDetik ? ':' + p(s) : '') + (lewat ? '⁺' : '');
}

/** Bangun satu perjalanan KA dari titik berangkat tertentu. */
function bangunPerjalanan(proyek, pola, sarana, urutan, ruas, nomor, berangkatAwal, arah) {
  const berhenti = new Set(
    pola.berhentiSemua ? urutan.map(s => s.kode) : (pola.berhentiDi || [])
  );
  berhenti.add(urutan[0].kode);
  berhenti.add(urutan[urutan.length - 1].kode);

  const dwell = Number(pola.dwell) || Number(proyek.parameter.dwellDefault) || 30;
  const titik = [];
  let t = berangkatAwal;

  titik.push({
    kode: urutan[0].kode, nama: urutan[0].nama, km: Number(urutan[0].km),
    datang: null, berangkat: t, berhenti: true, jalur: 1
  });

  for (let i = 0; i < ruas.length; i++) {
    const r = ruas[i];
    const st = urutan[i + 1];
    t += (r.waktuWT || 0);
    const stopDiSini = berhenti.has(st.kode);
    const akhir = (i === ruas.length - 1);
    titik.push({
      kode: st.kode, nama: st.nama, km: Number(st.km),
      datang: t,
      berangkat: akhir ? null : (stopDiSini ? t + dwell : t),
      berhenti: stopDiSini,
      jalur: 1
    });
    if (!akhir && stopDiSini) t += dwell;
  }

  return {
    nomor: String(nomor),
    polaId: pola.id,
    saranaId: pola.saranaId,
    arah: arah,
    relasi: urutan[0].kode + '–' + urutan[urutan.length - 1].kode,
    perjalanan: titik
  };
}

/** Hasilkan seluruh KA dari seluruh pola operasi. */
function buatJadwal(proyek) {
  const ka = [];
  const catatan = [];
  const wt = Number(proyek.parameter.wtPersen) || 0;

  (proyek.polaOperasi || []).forEach(pola => {
    const sarana = TTCModel.cariSarana(proyek, pola.saranaId);
    if (!sarana) { catatan.push('Pola "' + pola.nama + '" dilewati: sarana belum dipilih.'); return; }

    const mulai = jamKeDetik(pola.jamMulai);
    const akhir = jamKeDetik(pola.jamAkhir);
    const headway = (Number(pola.headway) || 0) * 60;
    if (mulai === null || akhir === null) { catatan.push('Pola "' + pola.nama + '" dilewati: jam operasi tidak valid.'); return; }
    if (headway <= 0) { catatan.push('Pola "' + pola.nama + '" dilewati: headway harus lebih dari 0 menit.'); return; }
    if (akhir <= mulai) { catatan.push('Pola "' + pola.nama + '" dilewati: jam akhir harus setelah jam mulai.'); return; }

    const arahHilir = TTCModel.lintasan(proyek, pola.dari, pola.ke);
    if (arahHilir.length < 2) { catatan.push('Pola "' + pola.nama + '" dilewati: relasi tidak ditemukan di jaringan.'); return; }

    const berhentiSet = new Set(pola.berhentiSemua ? arahHilir.map(s => s.kode) : (pola.berhentiDi || []));
    berhentiSet.add(pola.dari); berhentiSet.add(pola.ke);

    const ruasHilir = TTCDinamika.hitungLintasan(proyek, sarana, arahHilir, berhentiSet, wt);
    const rusak = ruasHilir.find(r => r.error);
    if (rusak) { catatan.push('Pola "' + pola.nama + '" dilewati: ' + rusak.error + ' (' + rusak.dari + '–' + rusak.ke + ').'); return; }

    const arahHulu = [...arahHilir].reverse();
    const ruasHulu = TTCDinamika.hitungLintasan(proyek, sarana, arahHulu, berhentiSet, wt);

    let n = 0;
    const langkah = Number(pola.langkahNomor) || 2;
    for (let t = mulai; t <= akhir; t += headway) {
      const nomorHilir = (Number(pola.nomorAwal) || 1) + n * langkah;
      ka.push(bangunPerjalanan(proyek, pola, sarana, arahHilir, ruasHilir, nomorHilir, t, 'hilir'));
      if (pola.duaArah) {
        ka.push(bangunPerjalanan(proyek, pola, sarana, arahHulu, ruasHulu, nomorHilir + 1, t, 'hulu'));
      }
      n++;
    }
  });

  ka.sort((a, b) => (a.perjalanan[0].berangkat - b.perjalanan[0].berangkat) ||
                    String(a.nomor).localeCompare(String(b.nomor)));
  return { ka, catatan, dibuat: new Date().toISOString() };
}

/** Ringkasan satu KA untuk tabel. */
function ringkasKA(k) {
  const p = k.perjalanan;
  const awal = p[0], akhir = p[p.length - 1];
  const durasi = (akhir.datang != null ? akhir.datang : akhir.berangkat) - awal.berangkat;
  const jarak = Math.abs(Number(akhir.km) - Number(awal.km));
  return {
    nomor: k.nomor, arah: k.arah, relasi: k.relasi,
    berangkat: awal.berangkat, tiba: akhir.datang,
    durasi: durasi, jarak: jarak,
    kecepatanRata: durasi > 0 ? (jarak / (durasi / 3600)) : 0,
    jumlahBerhenti: p.filter(x => x.berhenti).length
  };
}

global.TTCJadwal = { jamKeDetik, detikKeJam, buatJadwal, ringkasKA, HARI };
})(window);
