/* ============================================================
   TTC — Simulasi Operasi (kereta tunduk pada sinyal)

   Berbeda dari tampilan Simulasi biasa yang hanya memutar ulang
   jadwal, di sini kereta benar-benar dikendalikan:

     - tiap langkah waktu, kereta membaca aspek sinyal di depannya
     - aspek dihitung dari okupansi blok oleh kereta lain
     - MERAH  : mengerem sampai berhenti di muka sinyal
       KUNING : mengerem agar bisa berhenti di sinyal berikutnya
       HIJAU  : berjalan sampai kecepatan lintas
     - gerak dihitung dengan gaya tarik dan tahanan yang sama
       seperti mesin dinamika

   Hasilnya: keterlambatan yang benar-benar terjadi bila jadwal
   dijalankan di atas persinyalan yang ada.
   ============================================================ */
(function (global) {
'use strict';

const G = 9.80665, LAMBDA = 0.08;

function buat(proyek) {
  const sim = {
    proyek, t: 0, mulai: 0, kereta: [], blok: { hilir: [], hulu: [] },
    aspekSinyal: {}, catatan: [], jumlahTertahan: 0
  };

  /* ---------- siapkan blok ---------- */
  ['hilir', 'hulu'].forEach(a => {
    sim.blok[a] = TTCSinyal.blokLintas(proyek, a).map(b => Object.assign({}, b, {
      kmLo: Math.min(b.kmAwal, b.kmAkhir), kmHi: Math.max(b.kmAwal, b.kmAkhir), isi: new Set()
    }));
  });

  const petakDiKm = km => proyek.prasarana.petakJalan.find(p => {
    const A = TTCModel.cariStasiun(proyek, p.dari), B = TTCModel.cariStasiun(proyek, p.ke);
    if (!A || !B) return false;
    const lo = Math.min(A.km, B.km), hi = Math.max(A.km, B.km);
    return km >= lo - 0.001 && km <= hi + 0.001;
  }) || null;
  sim.petakDiKm = petakDiKm;

  /* ---------- siapkan kereta ---------- */
  (proyek.jadwal.ka || []).forEach(k => {
    const sarana = TTCModel.cariSarana(proyek, k.saranaId) || proyek.sarana[0];
    if (!sarana) return;
    const p = k.perjalanan;
    sim.kereta.push({
      nomor: k.nomor, arah: k.arah, sarana: sarana,
      titik: p, idx: 0,
      km: Number(p[0].km), v: 0,
      status: 'menunggu',        // menunggu | berjalan | berhenti | tertahan | selesai
      aspekDepan: null, sinyalDepan: null,
      berangkatJadwal: p[0].berangkat,
      terlambat: 0, terlambatMaks: 0,
      tertahanDetik: 0,
      dudukBlok: { hilir: [], hulu: [] },
      tahanSampai: null, mulaiTertahan: null,
      catatanTiba: []
    });
  });
  sim.kereta.sort((a, b) => a.berangkatJadwal - b.berangkatJadwal);

  /* ---------- okupansi ---------- */
  function bersihkanBlok(kr) {
    ['hilir', 'hulu'].forEach(a => {
      kr.dudukBlok[a].forEach(i => sim.blok[a][i] && sim.blok[a][i].isi.delete(kr.nomor));
      kr.dudukBlok[a] = [];
    });
  }
  function dudukiBlok(kr) {
    bersihkanBlok(kr);
    if (kr.status === 'selesai' || kr.status === 'menunggu') return;
    const pj = (Number(kr.sarana.panjang) || 200) / 1000;
    const depan = kr.km;
    const belakang = kr.arah === 'hilir' ? kr.km - pj : kr.km + pj;
    const lo = Math.min(depan, belakang), hi = Math.max(depan, belakang);

    const petak = petakDiKm(kr.km);
    const tunggal = petak && petak.jenisJalur === 'Tunggal';
    const arahDipakai = tunggal ? ['hilir', 'hulu'] : [kr.arah];

    arahDipakai.forEach(a => {
      sim.blok[a].forEach((b, i) => {
        if (hi >= b.kmLo - 0.0005 && lo <= b.kmHi + 0.0005) {
          b.isi.add(kr.nomor); kr.dudukBlok[a].push(i);
        }
      });
    });
  }

  /* ---------- sinyal di depan kereta ---------- */
  function blokDepan(kr) {
    const arr = sim.blok[kr.arah];
    for (let i = 0; i < arr.length; i++) {
      const b = arr[i];
      const mulai = kr.arah === 'hilir' ? b.kmAwal : b.kmAwal;
      const maju = kr.arah === 'hilir' ? (mulai > kr.km + 0.0005) : (mulai < kr.km - 0.0005);
      if (maju) return i;
    }
    return -1;
  }

  function bacaSinyal(kr) {
    const arr = sim.blok[kr.arah];
    const i = blokDepan(kr);
    if (i < 0) { kr.aspekDepan = null; kr.sinyalDepan = null; return null; }
    const terisi = k => {
      const b = arr[k];
      if (!b) return false;
      for (const n of b.isi) if (n !== kr.nomor) return true;
      return false;
    };
    const a = TTCSinyal.aspek(arr, i, terisi, 3);
    kr.aspekDepan = a;
    kr.sinyalDepan = arr[i].pelindungNomor;
    return { indeks: i, aspek: a, kmSinyal: arr[i].kmAwal, kmAkhirBlok: arr[i].kmAkhir };
  }

  /* ---------- batas kecepatan lintas ---------- */
  function batasKmh(kr, km) {
    const p = petakDiKm(km);
    const vLintas = p ? Number(p.kecepatanMaks) : 40;
    return Math.min(vLintas || 40, Number(kr.sarana.kecepatanMaks) || 90);
  }

  /* ---------- gerak ---------- */
  function percepatan(kr, v) {
    const s = kr.sarana;
    const mTon = (Number(s.massaKosong) || 200) + (Number(s.massaPenumpang) || 0);
    const vk = v * 3.6;
    const F = Math.min(mTon * 1000 * (Number(s.percepatan) || 0.8),
                       (Number(s.dayaKontinu) || 2000) * 1000 / Math.max(v, 0.5));
    const R = mTon * ((Number(s.davisA) || 15) + (Number(s.davisB) || 0.3) * vk + (Number(s.davisC) || 0.006) * vk * vk);
    return (F - R) / (mTon * 1000 * (1 + LAMBDA));
  }

  /** Titik henti terdekat di depan (km) beserta sebabnya. */
  function titikHenti(kr) {
    const daftar = [];
    const sig = bacaSinyal(kr);
    if (sig) {
      if (sig.aspek.kode === 'merah') daftar.push({ km: sig.kmSinyal, sebab: 'sinyal ' + kr.sinyalDepan + ' merah' });
      else if (sig.aspek.kode === 'kuning') daftar.push({ km: sig.kmAkhirBlok, sebab: 'sinyal berikut merah' });
    }
    const tj = kr.titik[kr.idx + 1];
    if (tj && (tj.berhenti || kr.idx + 1 === kr.titik.length - 1)) {
      daftar.push({ km: Number(tj.km), sebab: 'berhenti di ' + tj.kode });
    }
    let pilih = null;
    daftar.forEach(d => {
      const jarak = kr.arah === 'hilir' ? d.km - kr.km : kr.km - d.km;
      if (jarak < -0.02) return;
      if (!pilih || jarak < pilih.jarak) pilih = { km: d.km, sebab: d.sebab, jarak: Math.max(0, jarak) };
    });
    return pilih;
  }

  /* ---------- satu langkah ---------- */
  sim.langkah = function (dt) {
    sim.t += dt;

    // munculkan kereta yang waktunya berangkat
    sim.kereta.forEach(kr => {
      if (kr.status === 'menunggu' && sim.t >= kr.berangkatJadwal) {
        kr.status = 'berhenti'; kr.km = Number(kr.titik[0].km); kr.v = 0; dudukiBlok(kr);
      }
    });

    sim.kereta.forEach(kr => {
      if (kr.status === 'menunggu' || kr.status === 'selesai') return;

      const tSekarang = kr.titik[kr.idx];

      // menunggu jam berangkat di stasiun
      if (kr.status === 'berhenti') {
        const jadwalBerangkat = tSekarang.berangkat;
        if (jadwalBerangkat == null) { kr.status = 'selesai'; bersihkanBlok(kr); return; }
        if (sim.t < jadwalBerangkat) { kr.v = 0; return; }
      }

      const henti = titikHenti(kr);
      const bDinas = Number(kr.sarana.perlambatanDinas) || 0.9;
      const vBatas = batasKmh(kr, kr.km) / 3.6;

      let vIzin = vBatas;
      if (henti) {
        const jarakM = Math.max(0, henti.jarak * 1000);
        const vRem = Math.sqrt(Math.max(0, 2 * bDinas * jarakM));
        vIzin = Math.min(vIzin, vRem);
      }

      if (kr.v > vIzin + 0.05) {
        kr.v = Math.max(0, kr.v - bDinas * dt);
      } else {
        const a = percepatan(kr, kr.v);
        kr.v = Math.min(vIzin, Math.max(0, kr.v + a * dt));
      }

      // maju
      let kmBaru = kr.km + (kr.v * dt) / 1000 * (kr.arah === 'hilir' ? 1 : -1);

      // KA tidak boleh melewati sinyal yang menunjukkan aspek berhenti.
      // Berhenti 10 m di muka sinyal.
      const MARGIN = 0.010;
      if (henti && henti.sebab.indexOf('sinyal') === 0 && kr.aspekDepan && kr.aspekDepan.kode === 'merah') {
        const batas = kr.arah === 'hilir' ? henti.km - MARGIN : henti.km + MARGIN;
        const lewat = kr.arah === 'hilir' ? kmBaru >= batas : kmBaru <= batas;
        if (lewat) {
          kmBaru = batas;
          kr.v = 0;
          if (kr.status !== 'tertahan') { sim.jumlahTertahan++; kr.mulaiTertahan = sim.t; }
          kr.status = 'tertahan';
          kr.tertahanDetik += dt;
        }
      }
      if (kr.v > 0.15) kr.status = 'berjalan';

      // penahanan buatan (uji gangguan)
      if (kr.tahanSampai != null && sim.t < kr.tahanSampai) {
        kmBaru = kr.km; kr.v = 0; kr.status = 'tertahan'; kr.tertahanDetik += dt;
      } else if (kr.tahanSampai != null && sim.t >= kr.tahanSampai) {
        kr.tahanSampai = null;
      }

      kr.km = kmBaru;

      // sampai di titik berikutnya?
      const tj = kr.titik[kr.idx + 1];
      if (tj) {
        const lewat = kr.arah === 'hilir' ? kr.km >= Number(tj.km) - 0.002 : kr.km <= Number(tj.km) + 0.002;
        if (lewat) {
          kr.idx++;
          const jadwalDatang = tj.datang != null ? tj.datang : tj.berangkat;
          if (jadwalDatang != null) {
            kr.terlambat = sim.t - jadwalDatang;
            if (kr.terlambat > kr.terlambatMaks) kr.terlambatMaks = kr.terlambat;
            kr.catatanTiba.push({ kode: tj.kode, jadwal: jadwalDatang, nyata: sim.t, selisih: kr.terlambat });
          }
          if (kr.idx >= kr.titik.length - 1) {
            kr.status = 'selesai'; kr.v = 0; kr.km = Number(tj.km); bersihkanBlok(kr); return;
          }
          if (tj.berhenti) { kr.km = Number(tj.km); kr.v = 0; kr.status = 'berhenti'; }
        }
      }
      dudukiBlok(kr);
    });

    // aspek seluruh sinyal untuk tampilan
    sim.aspekSinyal = {};
    ['hilir', 'hulu'].forEach(a => {
      const arr = sim.blok[a];
      const terisi = k => arr[k] && arr[k].isi.size > 0;
      arr.forEach((b, i) => {
        sim.aspekSinyal[b.pelindung] = TTCSinyal.aspek(arr, i, terisi, 3);
      });
    });
  };

  sim.setWaktu = function (t) {
    sim.t = t;
    sim.kereta.forEach(kr => {
      kr.status = t >= kr.berangkatJadwal ? 'berhenti' : 'menunggu';
      kr.idx = 0; kr.km = Number(kr.titik[0].km); kr.v = 0;
      kr.terlambat = 0; kr.terlambatMaks = 0; kr.tertahanDetik = 0;
      kr.catatanTiba = []; kr.tahanSampai = null; bersihkanBlok(kr);
    });
    sim.jumlahTertahan = 0;
  };

  /** Tahan satu KA selama sekian detik — untuk menguji rambatan keterlambatan. */
  sim.tahan = function (nomor, detik) {
    const kr = sim.kereta.find(k => k.nomor === String(nomor));
    if (!kr) return false;
    kr.tahanSampai = sim.t + (Number(detik) || 0);
    return true;
  };

  sim.aktif = function () {
    return sim.kereta.filter(k => k.status !== 'menunggu' && k.status !== 'selesai');
  };

  sim.ringkasan = function () {
    const jalan = sim.aktif();
    const terlambat = jalan.filter(k => k.terlambat > 60);
    const total = sim.kereta.filter(k => k.catatanTiba.length);
    const rata = total.length ? total.reduce((a, k) => a + k.terlambatMaks, 0) / total.length : 0;
    const parah = total.reduce((a, k) => Math.max(a, k.terlambatMaks), 0);
    return {
      diLintas: jalan.length,
      tertahan: jalan.filter(k => k.status === 'tertahan').length,
      terlambat: terlambat.length,
      rataTerlambat: rata,
      terlambatTerparah: parah,
      selesai: sim.kereta.filter(k => k.status === 'selesai').length
    };
  };

  sim.setWaktu(0);
  return sim;
}

global.TTCSimOp = { buat };
})(window);
