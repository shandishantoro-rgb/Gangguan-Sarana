/* ============================================================
   TTC — Penggambar GAPEKA
   Grafik perjalanan kereta api: sumbu mendatar waktu,
   sumbu tegak stasiun berskala jarak (km).
   ============================================================ */
(function (global) {
'use strict';

const NS = 'http://www.w3.org/2000/svg';
const el = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e; };

const G = {
  proyek: null, jadwal: null, konflik: [],
  jamMulai: 4, jamAkhir: 24,
  pxPerJam: 260,
  tinggiGrafik: 620,
  marginAtas: 34, marginBawah: 26,
  sorot: null,          // nomor KA yang disorot
  onPilihKA: null
};

function stasiunTerpakai() {
  const s = [...G.proyek.prasarana.stasiun].sort((a, b) => a.km - b.km);
  return s;
}
function skalaY(list) {
  const minKm = Math.min(...list.map(s => Number(s.km)));
  const maxKm = Math.max(...list.map(s => Number(s.km)));
  const span = Math.max(maxKm - minKm, 0.001);
  const h = G.tinggiGrafik - G.marginAtas - G.marginBawah;
  return km => G.marginAtas + ((Number(km) - minKm) / span) * h;
}
const skalaX = d => ((d / 3600) - G.jamMulai) * G.pxPerJam;

function lebarTotal() { return (G.jamAkhir - G.jamMulai) * G.pxPerJam; }

/* ---------- kolom label stasiun (tetap, tidak ikut menggulung) ---------- */
function gambarLabel(svg) {
  const list = stasiunTerpakai();
  const y = skalaY(list);
  const W = 148;
  svg.setAttribute('width', W);
  svg.setAttribute('height', G.tinggiGrafik);
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + G.tinggiGrafik);
  svg.innerHTML = '';
  svg.appendChild(el('rect', { x: 0, y: 0, width: W, height: G.tinggiGrafik, class: 'gp-labelbg' }));
  svg.appendChild(el('text', { x: 10, y: 20, class: 'gp-kepala' })).textContent = 'STASIUN';
  // Penataan label: bila dua stasiun terlalu berdekatan pada skala jarak,
  // label diringkas atau dilewati agar tidak saling tindih. Garis tetap digambar.
  let yTerakhir = -999;
  list.forEach(s => {
    const yy = y(s.km);
    const jarak = yy - yTerakhir;
    svg.appendChild(el('line', { x1: W - 6, y1: yy, x2: W, y2: yy, class: 'gp-tick' }));
    if (jarak >= 24) {
      const t1 = el('text', { x: 10, y: yy - 1, class: 'gp-stnama' }); t1.textContent = s.nama;
      const t2 = el('text', { x: 10, y: yy + 11, class: 'gp-stkm' }); t2.textContent = s.kode + ' · km ' + Number(s.km).toFixed(1);
      svg.appendChild(t1); svg.appendChild(t2);
      yTerakhir = yy + 11;
    } else if (jarak >= 11) {
      const t = el('text', { x: 10, y: yy + 3, class: 'gp-stkm' });
      t.textContent = s.kode + ' · ' + s.nama;
      svg.appendChild(t);
      yTerakhir = yy + 3;
    }
  });
}

/* ---------- badan grafik ---------- */
function gambarGrafik(svg) {
  const list = stasiunTerpakai();
  const y = skalaY(list);
  const W = lebarTotal();
  svg.setAttribute('width', W);
  svg.setAttribute('height', G.tinggiGrafik);
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + G.tinggiGrafik);
  svg.innerHTML = '';

  // garis stasiun
  list.forEach(s => {
    svg.appendChild(el('line', { x1: 0, y1: y(s.km), x2: W, y2: y(s.km), class: 'gp-stasiun' }));
  });

  // kisi waktu
  for (let jam = G.jamMulai; jam <= G.jamAkhir; jam++) {
    const x = skalaX(jam * 3600);
    svg.appendChild(el('line', { x1: x, y1: G.marginAtas - 14, x2: x, y2: G.tinggiGrafik - G.marginBawah, class: 'gp-jam' }));
    const t = el('text', { x: x + 4, y: 16, class: 'gp-jamlabel' });
    t.textContent = String(jam % 24).padStart(2, '0') + '.00';
    svg.appendChild(t);
    for (let m = 10; m < 60; m += 10) {
      const xm = skalaX(jam * 3600 + m * 60);
      if (xm > W) break;
      svg.appendChild(el('line', {
        x1: xm, y1: G.marginAtas, x2: xm, y2: G.tinggiGrafik - G.marginBawah,
        class: m === 30 ? 'gp-menit30' : 'gp-menit'
      }));
    }
  }

  // garis KA
  if (G.jadwal && G.jadwal.ka) {
    G.jadwal.ka.forEach(k => {
      const titik = [];
      k.perjalanan.forEach(t => {
        if (t.datang != null) titik.push([skalaX(t.datang), y(t.km)]);
        if (t.berangkat != null) titik.push([skalaX(t.berangkat), y(t.km)]);
      });
      if (titik.length < 2) return;
      const d = titik.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      const disorot = G.sorot === k.nomor;
      const g = el('g', { class: 'gp-ka' + (disorot ? ' sorot' : '') });
      const hit = el('path', { d: d, class: 'gp-hit' });
      const jalur = el('path', { d: d, class: 'gp-garis ' + (k.arah === 'hilir' ? 'hilir' : 'hulu') });
      g.appendChild(hit); g.appendChild(jalur);
      const label = el('text', { x: titik[0][0] - 3, y: titik[0][1] - 5, class: 'gp-nomor' });
      label.textContent = k.nomor;
      g.appendChild(label);
      g.addEventListener('click', () => { G.sorot = (G.sorot === k.nomor ? null : k.nomor); if (G.onPilihKA) G.onPilihKA(G.sorot, k); });
      svg.appendChild(g);
    });
  }

  // penanda konflik
  (G.konflik || []).forEach(c => {
    const st = TTCModel.cariStasiun(G.proyek, String(c.lokasi).split('–')[0]);
    if (!st) return;
    const x = skalaX(c.waktu), yy = y(st.km);
    if (x < 0 || x > W) return;
    const g = el('g', { class: 'gp-konflik ' + (c.bobot === 'berat' ? 'berat' : 'sedang') });
    g.appendChild(el('circle', { cx: x, cy: yy, r: 6 }));
    const ttl = document.createElementNS(NS, 'title'); ttl.textContent = c.pesan;
    g.appendChild(ttl);
    svg.appendChild(g);
  });

  // kursor simulasi
  svg.appendChild(el('line', { id: 'gp-kursor', x1: -99, y1: 0, x2: -99, y2: G.tinggiGrafik, class: 'gp-kursor' }));
  const grup = el('g', { id: 'gp-posisi' });
  svg.appendChild(grup);
}

function gambar(opsi) {
  Object.assign(G, opsi || {});
  const svgLabel = document.getElementById('gapeka-label');
  const svgGraf = document.getElementById('gapeka-graf');
  if (!svgLabel || !svgGraf || !G.proyek) return;
  if (!G.proyek.prasarana.stasiun.length) { svgLabel.innerHTML = ''; svgGraf.innerHTML = ''; return; }
  gambarLabel(svgLabel);
  gambarGrafik(svgGraf);
}

/* ---------- simulasi: posisi KA pada detik t ---------- */
function posisiPadaWaktu(k, t) {
  const p = k.perjalanan;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1];
    const ta = (a.berangkat != null ? a.berangkat : a.datang);
    const tb = (b.datang != null ? b.datang : b.berangkat);
    if (a.datang != null && a.berangkat != null && t >= a.datang && t <= a.berangkat) return { km: a.km, berhenti: true };
    if (t >= ta && t <= tb) {
      const f = (tb === ta) ? 0 : (t - ta) / (tb - ta);
      return { km: Number(a.km) + (Number(b.km) - Number(a.km)) * f, berhenti: false };
    }
  }
  return null;
}

function gambarPosisi(t) {
  const svg = document.getElementById('gapeka-graf');
  if (!svg || !G.jadwal) return [];
  const list = stasiunTerpakai();
  if (!list.length) return [];
  const y = skalaY(list);
  const kursor = svg.querySelector('#gp-kursor');
  const x = skalaX(t);
  if (kursor) { kursor.setAttribute('x1', x); kursor.setAttribute('x2', x); }
  const grup = svg.querySelector('#gp-posisi');
  if (!grup) return [];
  grup.innerHTML = '';
  const aktif = [];
  G.jadwal.ka.forEach(k => {
    const pos = posisiPadaWaktu(k, t);
    if (!pos) return;
    aktif.push({ nomor: k.nomor, arah: k.arah, km: pos.km, berhenti: pos.berhenti });
    const c = el('circle', { cx: x, cy: y(pos.km), r: pos.berhenti ? 5 : 4,
      class: 'gp-titik ' + (k.arah === 'hilir' ? 'hilir' : 'hulu') + (pos.berhenti ? ' diam' : '') });
    grup.appendChild(c);
  });
  return aktif;
}

global.TTCGapeka = { gambar, gambarPosisi, posisiPadaWaktu, G };
})(window);
