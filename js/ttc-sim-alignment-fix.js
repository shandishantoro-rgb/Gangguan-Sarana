/* ============================================================
   TTC — Koreksi Alignment Simulasi GAPEKA
   Menyamakan tinggi/koordinat panel kiri, sumbu waktu, program,
   garis aktual, dan kursor setelah kanvas simulasi diperlebar.
   ============================================================ */
(function (global) {
'use strict';

const SIM_H = 520;
const $ = id => document.getElementById(id);

function injectStyle() {
  if ($('ttc-sim-alignment-style')) return;
  const s = document.createElement('style');
  s.id = 'ttc-sim-alignment-style';
  s.textContent = `
    #view-simulasi .gapeka-wrap.small{
      height:${SIM_H}px!important;
      min-height:${SIM_H}px!important;
      align-items:flex-start!important;
    }
    #view-simulasi #sim-label,
    #view-simulasi #sim-graf{
      height:${SIM_H}px!important;
      max-height:${SIM_H}px!important;
      display:block;
      flex:none;
    }
    #view-simulasi #sim-scroll{
      height:${SIM_H}px!important;
      max-height:${SIM_H}px!important;
      overflow:auto;
    }
  `;
  document.head.appendChild(s);
}

function syncGeometry() {
  const label = $('sim-label');
  const graf = $('sim-graf');
  const scroll = $('sim-scroll');
  if (!label || !graf) return;

  label.setAttribute('height', String(SIM_H));
  graf.setAttribute('height', String(SIM_H));

  const lv = label.getAttribute('viewBox');
  if (lv) {
    const a = lv.trim().split(/\s+/).map(Number);
    if (a.length === 4 && a.every(Number.isFinite)) {
      label.setAttribute('viewBox', [a[0], a[1], a[2], SIM_H].join(' '));
    }
  }
  const gv = graf.getAttribute('viewBox');
  if (gv) {
    const a = gv.trim().split(/\s+/).map(Number);
    if (a.length === 4 && a.every(Number.isFinite)) {
      graf.setAttribute('viewBox', [a[0], a[1], a[2], SIM_H].join(' '));
    }
  }

  if (scroll) scroll.style.height = SIM_H + 'px';
}

function patchGapekaHeight() {
  if (!global.TTCGapeka || TTCGapeka.__ttcSimAlignmentPatched) return false;
  const oldGambar = TTCGapeka.gambar;
  TTCGapeka.gambar = function (opsi) {
    const graf = document.getElementById('gapeka-graf');
    const diSimulasi = !!(graf && graf.closest('#view-simulasi'));
    const next = diSimulasi ? Object.assign({}, opsi || {}, { tinggiGrafik: SIM_H }) : opsi;
    const hasil = oldGambar(next);
    if (diSimulasi) requestAnimationFrame(syncGeometry);
    return hasil;
  };
  TTCGapeka.__ttcSimAlignmentPatched = true;
  return true;
}

function observeSimulation() {
  const view = $('view-simulasi');
  if (!view || !('MutationObserver' in global)) return;
  const ob = new MutationObserver(() => {
    if (view.classList.contains('active')) requestAnimationFrame(syncGeometry);
  });
  ob.observe(view, { attributes:true, attributeFilter:['class'], subtree:true, childList:true });
}

function init() {
  injectStyle();
  patchGapekaHeight();
  observeSimulation();
  setTimeout(syncGeometry, 0);
}

let tries = 0;
(function wait() {
  if (global.TTCGapeka) { init(); return; }
  if (++tries < 120) setTimeout(wait, 50);
})(window);

})(window);
