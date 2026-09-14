/* ============================================================
   TTC — Zoom Simulasi
   Menambah zoom pada Simulasi GAPEKA dan Simulasi Sinyal.
   Zoom hanya mengubah ukuran tampilan SVG, sehingga koordinat
   label kiri, sumbu waktu, garis program, garis aktual, dan kursor
   tetap berada pada sistem koordinat yang sama.
   ============================================================ */
(function (global) {
'use strict';

const $ = id => document.getElementById(id);
const MIN_Z = 0.35;
const MAX_Z = 3.00;
const STEP = 0.25;
let simZoom = 1;
let topoZoom = 1;
let simBaseWidth = 0;
let topoBaseWidth = 0;
let topoBaseHeight = 0;
let applying = false;

function clamp(v) { return Math.max(MIN_Z, Math.min(MAX_Z, v)); }
function pct(v) { return Math.round(v * 100) + '%'; }

function injectStyle() {
  if ($('ttc-sim-zoom-style')) return;
  const s = document.createElement('style');
  s.id = 'ttc-sim-zoom-style';
  s.textContent = `
    .ttc-zoom-group{display:inline-flex;align-items:center;gap:4px;padding:2px 5px;border:1px solid var(--rule);border-radius:7px;background:var(--panel)}
    .ttc-zoom-group .small-btn{padding:3px 8px;min-width:30px}
    .ttc-zoom-value{min-width:44px;text-align:center;font:600 10.5px var(--mono);color:var(--ink-2)}
    .ttc-zoom-fit{min-width:38px!important}
    #view-simulasi #sim-graf{transform-origin:0 0}
    #view-simsinyal #ttc-signal-topology{transform-origin:0 0}
  `;
  document.head.appendChild(s);
}

function makeControls(viewId, prefix, onMinus, onReset, onPlus, onFit) {
  const view = $(viewId);
  if (!view) return;
  const bar = view.querySelector('.sim-bar');
  if (!bar || $(prefix + '-zoom-group')) return;
  const g = document.createElement('div');
  g.id = prefix + '-zoom-group';
  g.className = 'ttc-zoom-group';
  g.innerHTML =
    '<button class="small-btn" type="button" title="Perkecil" data-z="minus">−</button>' +
    '<button class="small-btn" type="button" title="Kembali 100%" data-z="reset"><span class="ttc-zoom-value" id="' + prefix + '-zoom-value">100%</span></button>' +
    '<button class="small-btn" type="button" title="Perbesar" data-z="plus">＋</button>' +
    '<button class="small-btn ttc-zoom-fit" type="button" title="Pas ke lebar area" data-z="fit">Pas</button>';
  const slider = bar.querySelector('input[type="range"]');
  if (slider) bar.insertBefore(g, slider);
  else {
    const spacer = bar.querySelector('.spacer');
    if (spacer) bar.insertBefore(g, spacer);
    else bar.appendChild(g);
  }
  g.querySelector('[data-z="minus"]').onclick = onMinus;
  g.querySelector('[data-z="reset"]').onclick = onReset;
  g.querySelector('[data-z="plus"]').onclick = onPlus;
  g.querySelector('[data-z="fit"]').onclick = onFit;
}

function viewBoxSize(svg) {
  if (!svg) return null;
  const vb = (svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
  if (vb.length === 4 && vb.every(Number.isFinite)) return { width: vb[2], height: vb[3] };
  const w = Number(svg.getAttribute('width'));
  const h = Number(svg.getAttribute('height'));
  return Number.isFinite(w) && Number.isFinite(h) ? { width:w, height:h } : null;
}

function preserveCenter(scroller, oldW, oldH, fn) {
  if (!scroller) { fn(); return; }
  const cx = oldW > 0 ? (scroller.scrollLeft + scroller.clientWidth / 2) / oldW : 0.5;
  const cy = oldH > 0 ? (scroller.scrollTop + scroller.clientHeight / 2) / oldH : 0.5;
  fn();
  requestAnimationFrame(() => {
    const newW = Math.max(scroller.clientWidth, scroller.scrollWidth);
    const newH = Math.max(scroller.clientHeight, scroller.scrollHeight);
    scroller.scrollLeft = Math.max(0, cx * newW - scroller.clientWidth / 2);
    scroller.scrollTop = Math.max(0, cy * newH - scroller.clientHeight / 2);
  });
}

function applySimZoom(preserve) {
  if (applying) return;
  const svg = $('sim-graf');
  const sc = $('sim-scroll');
  const label = $('sim-label');
  if (!svg || !sc) return;
  const size = viewBoxSize(svg);
  if (!size) return;
  simBaseWidth = size.width;
  const oldW = parseFloat(svg.style.width) || simBaseWidth;
  const oldH = parseFloat(svg.style.height) || size.height;
  const work = () => {
    applying = true;
    svg.style.width = (simBaseWidth * simZoom) + 'px';
    svg.style.height = size.height + 'px';
    svg.style.maxWidth = 'none';
    if (label) {
      label.style.height = size.height + 'px';
      label.style.maxHeight = size.height + 'px';
    }
    const v = $('sim-zoom-value');
    if (v) v.textContent = pct(simZoom);
    applying = false;
  };
  if (preserve) preserveCenter(sc, oldW, oldH, work); else work();
}

function setSimZoom(v, preserve) {
  simZoom = clamp(Math.round(v * 100) / 100);
  applySimZoom(preserve !== false);
}
function fitSim() {
  const svg = $('sim-graf'), sc = $('sim-scroll');
  const size = viewBoxSize(svg);
  if (!svg || !sc || !size || !size.width) return;
  setSimZoom(sc.clientWidth / size.width, false);
  sc.scrollLeft = 0;
}

function topologyScroller() {
  const svg = $('ttc-signal-topology');
  return svg ? svg.closest('.skema-wrap') : null;
}

function applyTopoZoom(preserve) {
  if (applying) return;
  const svg = $('ttc-signal-topology');
  const sc = topologyScroller();
  if (!svg || !sc) return;
  const size = viewBoxSize(svg);
  if (!size) return;
  topoBaseWidth = size.width;
  topoBaseHeight = size.height;
  const oldW = parseFloat(svg.style.width) || topoBaseWidth;
  const oldH = parseFloat(svg.style.height) || topoBaseHeight;
  const work = () => {
    applying = true;
    svg.style.width = (topoBaseWidth * topoZoom) + 'px';
    svg.style.height = (topoBaseHeight * topoZoom) + 'px';
    svg.style.maxWidth = 'none';
    svg.style.maxHeight = 'none';
    const v = $('ss-zoom-value');
    if (v) v.textContent = pct(topoZoom);
    applying = false;
  };
  if (preserve) preserveCenter(sc, oldW, oldH, work); else work();
}

function setTopoZoom(v, preserve) {
  topoZoom = clamp(Math.round(v * 100) / 100);
  applyTopoZoom(preserve !== false);
}
function fitTopo() {
  const svg = $('ttc-signal-topology'), sc = topologyScroller();
  const size = viewBoxSize(svg);
  if (!svg || !sc || !size || !size.width || !size.height) return;
  const zx = sc.clientWidth / size.width;
  const zy = sc.clientHeight / size.height;
  setTopoZoom(Math.min(zx, zy), false);
  sc.scrollLeft = 0; sc.scrollTop = 0;
}

function bindWheel(el, getter, setter) {
  if (!el || el.dataset.ttcZoomWheel === '1') return;
  el.dataset.ttcZoomWheel = '1';
  el.addEventListener('wheel', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const z = getter();
    setter(z + (e.deltaY < 0 ? STEP : -STEP), true);
  }, { passive:false });
}

function setupControls() {
  makeControls('view-simulasi', 'sim',
    () => setSimZoom(simZoom - STEP, true),
    () => setSimZoom(1, true),
    () => setSimZoom(simZoom + STEP, true),
    fitSim);
  makeControls('view-simsinyal', 'ss',
    () => setTopoZoom(topoZoom - STEP, true),
    () => setTopoZoom(1, true),
    () => setTopoZoom(topoZoom + STEP, true),
    fitTopo);
  bindWheel($('sim-scroll'), () => simZoom, setSimZoom);
  bindWheel(topologyScroller(), () => topoZoom, setTopoZoom);
}

function observe() {
  const sim = $('sim-graf');
  if (sim && 'MutationObserver' in global) {
    const ob = new MutationObserver(() => {
      if (!applying) requestAnimationFrame(() => applySimZoom(false));
    });
    ob.observe(sim, { attributes:true, attributeFilter:['width','viewBox'] });
  }
  const host = document.querySelector('#view-simsinyal .skema-wrap');
  if (host && 'MutationObserver' in global) {
    const ob2 = new MutationObserver(() => {
      setupControls();
      if (!applying) requestAnimationFrame(() => applyTopoZoom(false));
    });
    ob2.observe(host, { childList:true, subtree:false });
  }
}

function init() {
  injectStyle();
  setupControls();
  applySimZoom(false);
  applyTopoZoom(false);
  observe();
  setInterval(() => {
    setupControls();
    const sv = $('sim-graf');
    if (sv) {
      const s = viewBoxSize(sv);
      if (s && s.width !== simBaseWidth) applySimZoom(false);
    }
    const tv = $('ttc-signal-topology');
    if (tv) {
      const s = viewBoxSize(tv);
      if (s && (s.width !== topoBaseWidth || s.height !== topoBaseHeight)) applyTopoZoom(false);
    }
  }, 500);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
else setTimeout(init, 0);

})(window);
