/* ============================================================
   TTC — Mesin Dinamika Perjalanan
   Menghitung waktu tempuh dari fisika gerak kereta, bukan dari
   pembagian jarak per kecepatan rata-rata.

   Dasar perhitungan (semuanya rumus terbuka di literatur teknik
   perkeretaapian, tidak diambil dari perangkat lunak mana pun):

   1. Tahanan jalan  — persamaan Davis:
        R = m · (A + B·v + C·v²)          [N],  m dalam ton, v dalam km/jam
   2. Tahanan tanjakan:
        Rg = m · g · (i / 1000)           [N],  i dalam per mil (‰)
   3. Tahanan lengkung — rumus Röckl:
        Rc = m · 6,5·9,81 / (R − 55)      [N],  R jari-jari dalam meter
   4. Gaya tarik:
        F = min( m · a0 , P / v )         gaya tetap di kecepatan rendah,
                                          daya tetap di kecepatan tinggi
   5. Percepatan efektif:
        a = (F − ΣR) / (m · (1 + λ))      λ = tambahan massa berputar ≈ 0,08

   Profil kecepatan disusun dua arah: sapuan mundur menyiapkan
   selubung pengereman agar kereta selalu bisa berhenti tepat pada
   batas kecepatan berikutnya, sapuan maju menerapkan gaya tarik.
   ============================================================ */
(function (global) {
'use strict';

const G = 9.80665;
const LAMBDA = 0.08;      // massa berputar
const DX = 5;             // langkah jarak, meter
const V_MIN = 0.5;        // m/s, lantai pembagi daya

const kmh = v => v * 3.6;
const ms  = v => v / 3.6;

/* massa dinas dalam ton */
function massaDinas(sarana, muatan) {
  const isi = (muatan === undefined ? 1 : muatan);
  return Number(sarana.massaKosong || 0) + Number(sarana.massaPenumpang || 0) * isi;
}

/* total tahanan (N) pada kecepatan v (m/s) */
function tahanan(sarana, mTon, v, gradien, radius) {
  const vk = kmh(v);
  const davis = mTon * (Number(sarana.davisA || 0)
                      + Number(sarana.davisB || 0) * vk
                      + Number(sarana.davisC || 0) * vk * vk);
  const grad = mTon * 1000 * G * (Number(gradien || 0) / 1000);
  const r = Number(radius || 0);
  const lengkung = (r > 55) ? mTon * 6.5 * G / (r - 55) : 0;
  return davis + grad + lengkung;
}

/* gaya tarik tersedia (N) pada kecepatan v (m/s) */
function gayaTarik(sarana, mTon, v) {
  const fMaks = mTon * 1000 * Number(sarana.percepatan || 0.8);
  const daya = Number(sarana.dayaKontinu || 0) * 1000;   // W
  if (daya <= 0) return fMaks;
  return Math.min(fMaks, daya / Math.max(v, V_MIN));
}

/**
 * Hitung waktu tempuh satu rangkaian segmen.
 * @param sarana  objek sarana
 * @param segmen  [{panjang, vBatas, gradien, radius}]  panjang meter, vBatas km/jam
 * @param opsi    {vAwal, vAkhir}  km/jam
 * @returns {waktu(detik), jarak(m), vMaks(km/jam), vRata(km/jam), profil}
 */
function hitungSegmen(sarana, segmen, opsi) {
  opsi = opsi || {};
  const mTon = massaDinas(sarana, opsi.muatan);
  const vMaksSarana = ms(Number(sarana.kecepatanMaks) || 90);
  const bDinas = Number(sarana.perlambatanDinas) || 0.9;

  // --- rakit kisi jarak ---
  const total = segmen.reduce((s, x) => s + Number(x.panjang || 0), 0);
  if (!(total > 0)) return { waktu: 0, jarak: 0, vMaks: 0, vRata: 0, profil: [] };

  const n = Math.max(2, Math.ceil(total / DX));
  const dx = total / n;
  const vBatas = new Float64Array(n + 1);
  const grad = new Float64Array(n + 1);
  const rad = new Float64Array(n + 1);

  let batasIdx = 0, batasAkum = Number(segmen[0].panjang || 0);
  for (let i = 0; i <= n; i++) {
    const s = i * dx;
    while (s > batasAkum && batasIdx < segmen.length - 1) {
      batasIdx++; batasAkum += Number(segmen[batasIdx].panjang || 0);
    }
    const seg = segmen[batasIdx];
    vBatas[i] = Math.min(vMaksSarana, ms(Number(seg.vBatas) || 40));
    grad[i] = Number(seg.gradien || 0);
    rad[i] = Number(seg.radius || 0);
  }

  const vAwal = Math.min(ms(Number(opsi.vAwal) || 0), vBatas[0]);
  const vAkhir = Math.min(ms(Number(opsi.vAkhir) || 0), vBatas[n]);

  // --- sapuan mundur: selubung pengereman ---
  const vRem = new Float64Array(n + 1);
  vRem[n] = vAkhir;
  for (let i = n - 1; i >= 0; i--) {
    const mampu = Math.sqrt(vRem[i + 1] * vRem[i + 1] + 2 * bDinas * dx);
    vRem[i] = Math.min(vBatas[i], mampu);
  }

  // --- sapuan maju: gaya tarik ---
  const v = new Float64Array(n + 1);
  v[0] = Math.min(vAwal, vRem[0]);
  for (let i = 0; i < n; i++) {
    const vi = v[i];
    const F = gayaTarik(sarana, mTon, vi);
    const R = tahanan(sarana, mTon, vi, grad[i], rad[i]);
    const a = (F - R) / (mTon * 1000 * (1 + LAMBDA));
    let vNext = Math.sqrt(Math.max(0, vi * vi + 2 * a * dx));
    vNext = Math.min(vNext, vBatas[i + 1], vRem[i + 1]);
    v[i + 1] = Math.max(vNext, 0.05);
  }
  v[n] = Math.min(v[n], vRem[n] || v[n]);

  // --- integrasi waktu ---
  let waktu = 0, vPuncak = 0;
  const profil = [];
  const tKum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const vr = (v[i] + v[i + 1]) / 2;
    waktu += dx / Math.max(vr, 0.05);
    tKum[i + 1] = waktu;
    if (v[i] > vPuncak) vPuncak = v[i];
    if (i % Math.ceil(n / 120) === 0) profil.push({ s: i * dx, v: kmh(v[i]) });
  }
  profil.push({ s: total, v: kmh(v[n]) });

  return {
    waktu: waktu,
    jarak: total,
    vMaks: kmh(vPuncak),
    vRata: kmh(total / Math.max(waktu, 0.001)),
    profil: profil,
    // kurva rinci untuk perhitungan blocking time
    kurva: { dx: dx, n: n, t: tKum, v: v, panjang: total }
  };
}

/**
 * Waktu tempuh antara dua stasiun bersebelahan (berhenti–berhenti,
 * atau langsung bila kereta tidak berhenti di salah satu ujung).
 */
function waktuPetak(proyek, sarana, kodeA, kodeB, opsi) {
  const petak = TTCModel.cariPetak(proyek, kodeA, kodeB);
  if (!petak) return null;
  const seg = [{
    panjang: Number(petak.jarak) * 1000,
    vBatas: Number(petak.kecepatanMaks) || 60,
    gradien: Number(petak.gradien) || 0,
    radius: Number(petak.radius) || 0
  }];
  const hasil = hitungSegmen(sarana, seg, opsi || {});
  hasil.petak = petak;
  return hasil;
}

/**
 * Hitung seluruh perjalanan sepanjang urutan stasiun.
 * @param polaBerhenti Set kode stasiun tempat KA berhenti
 * @returns [{dari, ke, jarak, waktuMurni, waktuWT, vMaks, berhentiDi}]
 */
function hitungLintasan(proyek, sarana, urutan, polaBerhenti, wtPersen) {
  const hasil = [];
  const wt = 1 + (Number(wtPersen) || 0) / 100;
  for (let i = 0; i < urutan.length - 1; i++) {
    const a = urutan[i], b = urutan[i + 1];
    const berhentiA = polaBerhenti.has(a.kode) || i === 0;
    const berhentiB = polaBerhenti.has(b.kode) || i === urutan.length - 2;

    // kecepatan awal/akhir: 0 bila berhenti, kalau lewat pakai batas petak
    const petak = TTCModel.cariPetak(proyek, a.kode, b.kode);
    if (!petak) { hasil.push({ dari: a.kode, ke: b.kode, error: 'Petak jalan belum didefinisikan' }); continue; }
    const vLewat = Math.min(Number(petak.kecepatanMaks) || 60, Number(sarana.kecepatanMaks) || 90);

    const r = waktuPetak(proyek, sarana, a.kode, b.kode, {
      vAwal: berhentiA ? 0 : vLewat,
      vAkhir: berhentiB ? 0 : vLewat
    });
    if (!r) { hasil.push({ dari: a.kode, ke: b.kode, error: 'Petak jalan tidak ditemukan' }); continue; }

    hasil.push({
      dari: a.kode, ke: b.kode,
      jarak: Number(petak.jarak),
      waktuMurni: r.waktu,
      waktuWT: r.waktu * wt,
      vMaks: r.vMaks,
      vRata: r.vRata,
      berhentiDi: berhentiB
    });
  }
  return hasil;
}

/** Waktu tempuh (detik) dari titik awal sampai jarak s meter. */
function waktuPadaJarak(kurva, s) {
  if (!kurva) return 0;
  const x = Math.max(0, Math.min(s, kurva.panjang));
  const f = x / kurva.dx;
  const i = Math.min(kurva.n - 1, Math.floor(f));
  const sisa = f - i;
  return kurva.t[i] + (kurva.t[i + 1] - kurva.t[i]) * sisa;
}
/** Kecepatan (m/s) pada jarak s meter. */
function kecepatanPadaJarak(kurva, s) {
  if (!kurva) return 0;
  const x = Math.max(0, Math.min(s, kurva.panjang));
  const f = x / kurva.dx;
  const i = Math.min(kurva.n - 1, Math.floor(f));
  const sisa = f - i;
  return kurva.v[i] + (kurva.v[i + 1] - kurva.v[i]) * sisa;
}

global.TTCDinamika = {
  waktuPadaJarak, kecepatanPadaJarak,
  hitungSegmen, waktuPetak, hitungLintasan, massaDinas, tahanan, gayaTarik
};
})(window);
