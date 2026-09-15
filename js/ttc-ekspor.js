/* ============================================================
   TTC — Ekspor Hasil Kerja
   ============================================================ */
(function (global) {
'use strict';

function unduh(namaBerkas, isi, tipe) {
  const blob = (isi instanceof Blob) ? isi : new Blob([isi], { type: tipe || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = namaBerkas;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function csvAman(v) {
  const s = String(v == null ? '' : v);
  return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** Daftar Waktu: satu baris per KA per stasiun. */
function daftarWaktuCSV(proyek, jadwal) {
  const baris = [['Nomor KA', 'Arah', 'Relasi', 'Urut', 'Kode', 'Stasiun', 'Km', 'Datang', 'Berangkat', 'Berhenti']];
  jadwal.ka.forEach(k => {
    k.perjalanan.forEach((t, i) => {
      baris.push([
        k.nomor, k.arah, k.relasi, i + 1, t.kode, t.nama, Number(t.km).toFixed(3),
        t.datang != null ? TTCJadwal.detikKeJam(t.datang, true) : '',
        t.berangkat != null ? TTCJadwal.detikKeJam(t.berangkat, true) : '',
        t.berhenti ? 'Ya' : 'Langsung'
      ]);
    });
  });
  return baris.map(r => r.map(csvAman).join(';')).join('\n');
}

/** Matriks jadwal: stasiun sebagai baris, KA sebagai kolom (gaya daftar waktu cetak). */
function matriksCSV(proyek, jadwal, arah) {
  const ka = jadwal.ka.filter(k => !arah || k.arah === arah);
  const stasiun = [...proyek.prasarana.stasiun].sort((a, b) => a.km - b.km);
  const kepala = ['Kode', 'Stasiun', 'Km', ...ka.map(k => k.nomor)];
  const baris = [kepala];
  stasiun.forEach(s => {
    const r = [s.kode, s.nama, Number(s.km).toFixed(3)];
    ka.forEach(k => {
      const t = k.perjalanan.find(x => x.kode === s.kode);
      if (!t) { r.push(''); return; }
      const brk = t.berangkat != null ? TTCJadwal.detikKeJam(t.berangkat) : '';
      const dtg = t.datang != null ? TTCJadwal.detikKeJam(t.datang) : '';
      r.push(t.berhenti && dtg && brk ? dtg + '/' + brk : (brk || dtg));
    });
    baris.push(r);
  });
  return baris.map(r => r.map(csvAman).join(';')).join('\n');
}

function konflikCSV(temuan) {
  const baris = [['Waktu', 'Jenis', 'Bobot', 'Lokasi', 'KA terlibat', 'Keterangan']];
  temuan.forEach(t => baris.push([
    TTCJadwal.detikKeJam(t.waktu), t.jenis, t.bobot, t.lokasi, (t.ka || []).join(' & '), t.pesan
  ]));
  return baris.map(r => r.map(csvAman).join(';')).join('\n');
}

/** Gabungkan kolom label + badan grafik jadi satu SVG utuh. */
function gapekaSVG() {
  const a = document.getElementById('gapeka-label');
  const b = document.getElementById('gapeka-graf');
  if (!a || !b) return null;
  const wa = +a.getAttribute('width'), wb = +b.getAttribute('width');
  const h = +b.getAttribute('height');
  const gaya = document.getElementById('gaya-gapeka');
  const css = gaya ? gaya.textContent : '';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + (wa + wb) + '" height="' + h +
    '" viewBox="0 0 ' + (wa + wb) + ' ' + h + '">' +
    '<style>' + css + '</style>' +
    '<rect width="100%" height="100%" fill="#ffffff"/>' +
    '<g>' + a.innerHTML + '</g>' +
    '<g transform="translate(' + wa + ',0)">' + b.innerHTML + '</g>' +
    '</svg>';
}

function unduhGapekaSVG(nama) {
  const s = gapekaSVG();
  if (!s) return false;
  unduh((nama || 'gapeka') + '.svg', s, 'image/svg+xml;charset=utf-8');
  return true;
}

function unduhGapekaPNG(nama, skala) {
  const s = gapekaSVG();
  if (!s) return Promise.resolve(false);
  const k = skala || 2;
  return new Promise(resolve => {
    const img = new Image();
    const blob = new Blob([s], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width * k; c.height = img.height * k;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(bl => { unduh((nama || 'gapeka') + '.png', bl, 'image/png'); URL.revokeObjectURL(url); resolve(true); }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
    img.src = url;
  });
}

global.TTCEkspor = { unduh, daftarWaktuCSV, matriksCSV, konflikCSV, unduhGapekaSVG, unduhGapekaPNG, gapekaSVG };
})(window);

/* TTC project library loader */
(function () {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.add('pm-boot');
  try { window.__TTC_HAD_LEGACY_AUTO__ = !!localStorage.getItem('ttc-proyek-otomatis'); } catch (e) { window.__TTC_HAD_LEGACY_AUTO__ = false; }
  const store = document.createElement('script');
  store.src = 'js/ttc-proyek.js';
  store.onload = function () {
    const manager = document.createElement('script');
    manager.src = 'js/ttc-project-manager.js';
    document.head.appendChild(manager);
  };
  document.head.appendChild(store);

  /* Penyempurnaan simulasi, visual GAPEKA, dan topologi cabang. */
  const visual = document.createElement('script');
  visual.src = 'js/ttc-sim-visual.js';
  visual.onload = function () {
    const align = document.createElement('script');
    align.src = 'js/ttc-sim-alignment-fix.js';
    document.head.appendChild(align);
  };
  document.head.appendChild(visual);

  /* Perjalanan KA individual dan Daftar Waktu editable. */
  const course = document.createElement('script');
  course.src = 'js/ttc-course-service.js';
  document.head.appendChild(course);
})();