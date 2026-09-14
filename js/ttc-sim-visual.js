/* ============================================================
   TTC — Penyempurnaan Visual Simulasi & Topologi Cabang
   - lintasan mengikuti graf petak (mendukung percabangan)
   - label nomor KA berada di badan garis
   - simulasi menampilkan program abu-abu + garis aktual progresif
   - simulasi sinyal memakai diagram topologi bercabang yang lebih lebar
   ============================================================ */
(function (global) {
'use strict';

const NS = 'http://www.w3.org/2000/svg';
const AUTO_KEY = 'ttc-proyek-otomatis';
const $ = id => document.getElementById(id);
const svgEl = (tag, attrs) => {
  const e = document.createElementNS(NS, tag);
  Object.keys(attrs || {}).forEach(k => e.setAttribute(k, attrs[k]));
  return e;
};

function injectStyle() {
  if ($('ttc-sim-visual-style')) return;
  const s = document.createElement('style');
  s.id = 'ttc-sim-visual-style';
  s.textContent = `
    #view-simulasi .sim-panel{grid-template-columns:minmax(0,4.2fr) minmax(280px,1fr)!important}
    #view-simulasi .gapeka-wrap.small{height:520px!important;min-height:520px}
    #view-simulasi .sim-daftar{max-width:380px}
    #view-simulasi .gapeka-label,#view-simulasi .gapeka-scroll{height:520px}
    #view-simulasi .ttc-sim-program .gp-garis{stroke:#aeb8c2!important;stroke-width:1.25!important;opacity:.62}
    #view-simulasi .ttc-sim-program .gp-hit{pointer-events:none}
    #view-simulasi .ttc-sim-program .gp-nomor{display:none}
    .gp-nomor.ttc-body-label{font:600 8.5px var(--mono);paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round;text-anchor:middle}
    .ttc-sim-actual-line{fill:none;stroke-width:2.5!important;stroke-linecap:round;stroke-linejoin:round}
    .ttc-sim-actual-line.hilir{stroke:#1f5fa8!important}
    .ttc-sim-actual-line.hulu{stroke:#c0402d!important}
    .ttc-sim-actual-label{font:700 9px var(--mono);fill:#17222d;paint-order:stroke;stroke:#fff;stroke-width:3.5px;stroke-linejoin:round;text-anchor:middle}
    #view-simsinyal .skema-wrap{min-height:500px;padding:10px;overflow:auto;background:#f7f9fb}
    #view-simsinyal #strip-lintas{display:none!important}
    #ttc-signal-topology{display:block;min-width:1380px;height:480px;background:#f9fbfc;border-radius:6px}
    .ttc-topo-track{fill:none;stroke:#60707d;stroke-width:5;stroke-linecap:round;stroke-linejoin:round}
    .ttc-topo-track.ganda{stroke:#526270;stroke-width:6}
    .ttc-topo-track-inner{fill:none;stroke:#f9fbfc;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .ttc-topo-route{fill:none;stroke:#2f6ca8;stroke-width:8;stroke-linecap:round;stroke-linejoin:round;opacity:.28}
    .ttc-topo-occupied{fill:none;stroke:#d67a2e;stroke-width:9;stroke-linecap:round;stroke-linejoin:round;opacity:.86}
    .ttc-topo-st{fill:#fff;stroke:#263846;stroke-width:2}
    .ttc-topo-st.junction{fill:#eaf2fb;stroke:#1f5fa8;stroke-width:2.5}
    .ttc-topo-st-name{font:700 11px var(--sans);fill:#17222d;text-anchor:middle;paint-order:stroke;stroke:#fff;stroke-width:3px}
    .ttc-topo-st-code{font:9px var(--mono);fill:#6b7a87;text-anchor:middle}
    .ttc-topo-signal-post{stroke:#677784;stroke-width:1.4}
    .ttc-topo-signal{stroke:#fff;stroke-width:1.2}
    .ttc-topo-signal-label{font:7.5px var(--mono);fill:#5f6f7d;text-anchor:middle}
    .ttc-topo-train{stroke:#fff;stroke-width:1.5}
    .ttc-topo-train.hilir{fill:#1f5fa8}.ttc-topo-train.hulu{fill:#c0402d}
    .ttc-topo-train.wait{fill:#d67a2e}
    .ttc-topo-train-label{font:700 9.5px var(--mono);fill:#16222c;text-anchor:middle;paint-order:stroke;stroke:#fff;stroke-width:3.5px}
    .ttc-topo-legend{font:9.5px var(--sans);fill:#50606d}
    .ttc-topo-title{font:700 12px var(--sans);fill:#263642}
    .ttc-topo-sub{font:9px var(--mono);fill:#74838f}
    .ttc-topo-badge{fill:#eef3f7;stroke:#d1dce4;stroke-width:1}
    @media(max-width:1000px){#view-simulasi .sim-panel{grid-template-columns:1fr!important}#view-simulasi .sim-daftar{max-width:none}}
  `;
  document.head.appendChild(s);
}

function loadProject() {
  if (global.__TTC_SIM_PROJECT__) return global.__TTC_SIM_PROJECT__;
  try {
    const raw = localStorage.getItem(AUTO_KEY);
    return raw && global.TTCModel ? TTCModel.migrasi(JSON.parse(raw)) : null;
  } catch (e) { return null; }
}

function patchGraphRoute() {
  if (!global.TTCModel || TTCModel.__ttcGraphRoutePatched) return;
  const original = TTCModel.lintasan;
  TTCModel.lintasanLinear = original;
  TTCModel.lintasan = function (proyek, dari, ke) {
    if (!proyek || !proyek.prasarana || dari === ke) {
      const s = proyek && proyek.prasarana ? TTCModel.cariStasiun(proyek, dari) : null;
      return s ? [s] : [];
    }
    const st = new Map((proyek.prasarana.stasiun || []).map(s => [s.kode, s]));
    if (!st.has(dari) || !st.has(ke)) return [];
    const adj = new Map();
    st.forEach((_, k) => adj.set(k, []));
    (proyek.prasarana.petakJalan || []).forEach(p => {
      if (!st.has(p.dari) || !st.has(p.ke)) return;
      const a = st.get(p.dari), b = st.get(p.ke);
      const w = Math.max(0.001, Number(p.jarak) || Math.abs(Number(a.km) - Number(b.km)) || 1);
      adj.get(p.dari).push({ kode:p.ke, w });
      adj.get(p.ke).push({ kode:p.dari, w });
    });
    const dist = new Map(), prev = new Map(), belum = new Set(st.keys());
    st.forEach((_, k) => dist.set(k, Infinity));
    dist.set(dari, 0);
    while (belum.size) {
      let u = null, best = Infinity;
      belum.forEach(k => { const d = dist.get(k); if (d < best) { best = d; u = k; } });
      if (u == null || best === Infinity) break;
      belum.delete(u);
      if (u === ke) break;
      (adj.get(u) || []).forEach(e => {
        if (!belum.has(e.kode)) return;
        const nd = best + e.w;
        if (nd < dist.get(e.kode)) { dist.set(e.kode, nd); prev.set(e.kode, u); }
      });
    }
    if (!prev.has(ke)) return [];
    const kode = [ke];
    while (kode[0] !== dari) {
      const p = prev.get(kode[0]);
      if (!p) return [];
      kode.unshift(p);
    }
    return kode.map(k => st.get(k)).filter(Boolean);
  };
  TTCModel.__ttcGraphRoutePatched = true;

  if (global.TTCJadwal && !TTCJadwal.__ttcBranchSummaryPatched) {
    const ringkas = TTCJadwal.ringkasKA;
    TTCJadwal.ringkasKA = function (k) {
      const r = ringkas(k);
      const proyek = global.__TTC_SIM_PROJECT__ || loadProject();
      if (!proyek) return r;
      let jarak = 0;
      for (let i = 0; i < k.perjalanan.length - 1; i++) {
        const p = TTCModel.cariPetak(proyek, k.perjalanan[i].kode, k.perjalanan[i+1].kode);
        if (p) jarak += Number(p.jarak) || 0;
      }
      if (jarak > 0) {
        r.jarak = jarak;
        r.kecepatanRata = r.durasi > 0 ? jarak / (r.durasi / 3600) : 0;
      }
      return r;
    };
    TTCJadwal.__ttcBranchSummaryPatched = true;
  }
}

function patchSimOpCapture() {
  if (!global.TTCSimOp || TTCSimOp.__ttcCaptured) return;
  const buat = TTCSimOp.buat;
  TTCSimOp.buat = function (proyek) {
    const sim = buat(proyek);
    global.__TTC_SIMOP__ = sim;
    global.__TTC_SIM_PROJECT__ = proyek;
    return sim;
  };
  TTCSimOp.__ttcCaptured = true;
}

function midpointOnPath(path, ratio) {
  try {
    const len = path.getTotalLength();
    return path.getPointAtLength(Math.max(0, Math.min(len, len * ratio)));
  } catch (e) { return null; }
}

function pointAtX(path, x) {
  try {
    const len = path.getTotalLength();
    let lo = 0, hi = len;
    for (let i=0;i<18;i++) {
      const mid = (lo+hi)/2;
      const p = path.getPointAtLength(mid);
      if (p.x < x) lo = mid; else hi = mid;
    }
    return path.getPointAtLength((lo+hi)/2);
  } catch (e) { return null; }
}

function bodyLabels(svg) {
  if (!svg) return;
  svg.querySelectorAll('.gp-ka').forEach(g => {
    const path = g.querySelector('.gp-garis');
    const label = g.querySelector('.gp-nomor');
    if (!path || !label) return;
    const p = midpointOnPath(path, .48);
    if (!p) return;
    label.setAttribute('x', p.x);
    label.setAttribute('y', p.y - 6);
    label.setAttribute('text-anchor','middle');
    label.classList.add('ttc-body-label');
  });
}

function renderActualTrace(svg, t) {
  if (!svg || !svg.closest('#view-simulasi') || !global.TTCGapeka) return;
  const oldActual = svg.querySelector('#ttc-sim-actual'); if (oldActual) oldActual.remove();
  const oldDefs = svg.querySelector('#ttc-sim-clip'); if (oldDefs) oldDefs.remove();
  const xNow = ((t / 3600) - TTCGapeka.G.jamMulai) * TTCGapeka.G.pxPerJam;
  const defs = svgEl('defs', { id:'ttc-sim-clip' });
  const clip = svgEl('clipPath', { id:'ttc-sim-clip-path' });
  clip.appendChild(svgEl('rect', { x:0, y:0, width:Math.max(0,xNow), height:TTCGapeka.G.tinggiGrafik }));
  defs.appendChild(clip);
  const actual = svgEl('g', { id:'ttc-sim-actual', 'clip-path':'url(#ttc-sim-clip-path)' });

  svg.querySelectorAll('.gp-ka').forEach(g => {
    const src = g.querySelector('.gp-garis');
    const nomor = g.querySelector('.gp-nomor') ? g.querySelector('.gp-nomor').textContent : '';
    if (!src) return;
    let start, end;
    try { const len=src.getTotalLength(); start=src.getPointAtLength(0); end=src.getPointAtLength(len); }
    catch(e){ return; }
    if (xNow < start.x) return;
    const c = src.cloneNode(false);
    c.removeAttribute('id');
    c.classList.add('ttc-sim-actual-line');
    actual.appendChild(c);
    const visEnd = Math.min(xNow, end.x);
    const targetX = start.x + Math.max(0, visEnd-start.x) * .55;
    if (targetX > start.x + 8) {
      const p = pointAtX(src, targetX);
      if (p) {
        const tx = svgEl('text', { x:p.x, y:p.y-7, class:'ttc-sim-actual-label' });
        tx.textContent = nomor;
        actual.appendChild(tx);
      }
    }
  });
  const pos = svg.querySelector('#gp-posisi');
  if (pos) { svg.insertBefore(defs, pos); svg.insertBefore(actual, pos); }
  else { svg.appendChild(defs); svg.appendChild(actual); }
}

function patchGapeka() {
  if (!global.TTCGapeka || TTCGapeka.__ttcVisualPatched) return;
  const gambar = TTCGapeka.gambar;
  const posisi = TTCGapeka.gambarPosisi;
  TTCGapeka.gambar = function (opsi) {
    const r = gambar(opsi);
    const svg = document.getElementById('gapeka-graf');
    bodyLabels(svg);
    if (svg && svg.closest('#view-simulasi')) svg.classList.add('ttc-sim-program');
    return r;
  };
  TTCGapeka.gambarPosisi = function (t) {
    const aktif = posisi(t);
    const svg = document.getElementById('gapeka-graf');
    renderActualTrace(svg, t);
    return aktif;
  };
  TTCGapeka.__ttcVisualPatched = true;
}

function edgeKey(a,b){ return [String(a),String(b)].sort().join('::'); }

function buildLayout(proyek, W, H) {
  const st = proyek.prasarana.stasiun || [];
  const petak = proyek.prasarana.petakJalan || [];
  const by = new Map(st.map(s=>[s.kode,s]));
  const adj = new Map(st.map(s=>[s.kode,[]]));
  petak.forEach(p=>{
    if(!adj.has(p.dari)||!adj.has(p.ke)) return;
    adj.get(p.dari).push(p.ke); adj.get(p.ke).push(p.dari);
  });
  const sorted = st.slice().sort((a,b)=>Number(a.km)-Number(b.km));
  const first=sorted[0], last=sorted[sorted.length-1];
  const main = first && last ? TTCModel.lintasan(proyek,first.kode,last.kode).map(s=>s.kode) : [];
  const mainSet = new Set(main);
  const lane = new Map(main.map(k=>[k,0]));
  let branchNo=0;
  main.forEach(m=>{
    (adj.get(m)||[]).forEach(n=>{
      if(mainSet.has(n)||lane.has(n)) return;
      branchNo++;
      const sign = branchNo%2 ? -1 : 1;
      const lv = sign * Math.ceil(branchNo/2);
      const q=[n]; lane.set(n,lv);
      while(q.length){
        const u=q.shift();
        (adj.get(u)||[]).forEach(v=>{
          if(mainSet.has(v)||lane.has(v)) return;
          lane.set(v,lv); q.push(v);
        });
      }
    });
  });
  sorted.forEach(s=>{ if(!lane.has(s.kode)) lane.set(s.kode, ++branchNo); });
  const minKm=Math.min(...st.map(s=>Number(s.km))), maxKm=Math.max(...st.map(s=>Number(s.km)));
  const span=Math.max(.001,maxKm-minKm);
  const x=k=>80+((Number(k)-minKm)/span)*(W-160);
  const center=H/2;
  const pos=new Map();
  st.forEach(s=>pos.set(s.kode,{x:x(s.km),y:center+(lane.get(s.kode)||0)*105,lane:lane.get(s.kode)||0}));
  return {pos,adj,mainSet,by,minKm,maxKm};
}

function signalPoint(proyek, layout, sg) {
  const st = sg.stasiun && layout.pos.get(sg.stasiun);
  if (st) return {x:st.x + (sg.arah==='hilir'?18:-18), y:st.y + (sg.arah==='hilir'?-22:22)};
  const km=Number(sg.km);
  let best=null;
  (proyek.prasarana.petakJalan||[]).forEach(p=>{
    const A=layout.by.get(p.dari), B=layout.by.get(p.ke), pa=layout.pos.get(p.dari), pb=layout.pos.get(p.ke);
    if(!A||!B||!pa||!pb) return;
    const lo=Math.min(Number(A.km),Number(B.km)), hi=Math.max(Number(A.km),Number(B.km));
    const outside=km<lo?lo-km:km>hi?km-hi:0;
    if(!best||outside<best.out){
      const f=Math.abs(Number(B.km)-Number(A.km))<.001?.5:(km-Number(A.km))/(Number(B.km)-Number(A.km));
      const q=Math.max(0,Math.min(1,f));
      best={out:outside,x:pa.x+(pb.x-pa.x)*q,y:pa.y+(pb.y-pa.y)*q};
    }
  });
  return best||{x:80,y:240};
}

function trainPoint(layout, kr) {
  const a=kr.titik && kr.titik[kr.idx], b=kr.titik && kr.titik[Math.min(kr.idx+1,kr.titik.length-1)];
  if(!a||!b) return null;
  const pa=layout.pos.get(a.kode), pb=layout.pos.get(b.kode);
  if(!pa||!pb) return null;
  const ak=Number(a.km), bk=Number(b.km);
  let f=Math.abs(bk-ak)<.001?0:(Number(kr.km)-ak)/(bk-ak);
  f=Math.max(0,Math.min(1,f));
  return {x:pa.x+(pb.x-pa.x)*f,y:pa.y+(pb.y-pa.y)*f,a:a.kode,b:b.kode,f};
}

function renderTopology() {
  const host = document.querySelector('#view-simsinyal .skema-wrap');
  if (!host) return;
  let svg = $('ttc-signal-topology');
  if (!svg) {
    svg = svgEl('svg',{id:'ttc-signal-topology',viewBox:'0 0 1500 480',preserveAspectRatio:'xMidYMid meet'});
    host.appendChild(svg);
  }
  const sim = global.__TTC_SIMOP__;
  const proyek = (sim && sim.proyek) || loadProject();
  if (!proyek || !proyek.prasarana || !(proyek.prasarana.stasiun||[]).length) return;
  const W=Math.max(1500,(proyek.prasarana.stasiun.length||1)*82), H=480;
  svg.setAttribute('viewBox','0 0 '+W+' '+H);
  svg.setAttribute('width',W);
  svg.innerHTML='';
  const layout=buildLayout(proyek,W,H);

  const title=svgEl('text',{x:24,y:28,class:'ttc-topo-title'}); title.textContent='Topologi lintas & simulasi sinyal'; svg.appendChild(title);
  const sub=svgEl('text',{x:24,y:46,class:'ttc-topo-sub'}); sub.textContent='jalur abu-abu = jaringan · biru = rute KA aktif · oranye = petak sedang ditempati'; svg.appendChild(sub);

  const active = sim ? sim.aktif() : [];
  const routeEdges=new Set(), occupied=new Map();
  active.forEach(kr=>{
    if(!kr.titik) return;
    for(let i=Math.max(0,kr.idx);i<Math.min(kr.titik.length-1,kr.idx+3);i++) routeEdges.add(edgeKey(kr.titik[i].kode,kr.titik[i+1].kode));
    const tp=trainPoint(layout,kr); if(tp){const k=edgeKey(tp.a,tp.b); if(!occupied.has(k))occupied.set(k,[]); occupied.get(k).push(kr);}
  });

  (proyek.prasarana.petakJalan||[]).forEach(p=>{
    const a=layout.pos.get(p.dari), b=layout.pos.get(p.ke); if(!a||!b)return;
    const d='M'+a.x+' '+a.y+' L'+b.x+' '+b.y;
    svg.appendChild(svgEl('path',{d,class:'ttc-topo-track '+(p.jenisJalur==='Ganda'?'ganda':'')}));
    if(p.jenisJalur==='Ganda')svg.appendChild(svgEl('path',{d,class:'ttc-topo-track-inner'}));
    const k=edgeKey(p.dari,p.ke);
    if(routeEdges.has(k))svg.appendChild(svgEl('path',{d,class:'ttc-topo-route'}));
    if(occupied.has(k))svg.appendChild(svgEl('path',{d,class:'ttc-topo-occupied'}));
  });

  (proyek.prasarana.stasiun||[]).forEach(s=>{
    const p=layout.pos.get(s.kode); if(!p)return;
    const deg=(layout.adj.get(s.kode)||[]).length;
    svg.appendChild(svgEl('circle',{cx:p.x,cy:p.y,r:deg>2?8:6,class:'ttc-topo-st'+(deg>2?' junction':'')}));
    const n=svgEl('text',{x:p.x,y:p.y-18,class:'ttc-topo-st-name'}); n.textContent=s.nama; svg.appendChild(n);
    const c=svgEl('text',{x:p.x,y:p.y+22,class:'ttc-topo-st-code'}); c.textContent=s.kode+' · km '+Number(s.km).toFixed(1)+(deg>2?' · JUNCTION':''); svg.appendChild(c);
  });

  (proyek.prasarana.sinyal||[]).filter(sg=>!global.TTCSinyal||TTCSinyal.JENIS_UTAMA.indexOf(sg.jenis)>=0).forEach(sg=>{
    const p=signalPoint(proyek,layout,sg), aspect=sim&&sim.aspekSinyal?sim.aspekSinyal[sg.id]:null, col=aspect?aspect.warna:'#7f8d98';
    const dy=sg.arah==='hilir'?-15:15;
    svg.appendChild(svgEl('line',{x1:p.x,y1:p.y,x2:p.x,y2:p.y+dy,class:'ttc-topo-signal-post'}));
    svg.appendChild(svgEl('circle',{cx:p.x,cy:p.y+dy,r:4.5,fill:col,class:'ttc-topo-signal'}));
    const tx=svgEl('text',{x:p.x,y:p.y+dy+(sg.arah==='hilir'?-8:14),class:'ttc-topo-signal-label'}); tx.textContent=sg.nomor; svg.appendChild(tx);
  });

  active.forEach(kr=>{
    const p=trainPoint(layout,kr); if(!p)return;
    const tri=svgEl('path',{d:'M'+p.x+' '+(p.y-9)+' L'+(p.x+8)+' '+(p.y+7)+' L'+(p.x-8)+' '+(p.y+7)+' Z',class:'ttc-topo-train '+kr.arah+(kr.status==='tertahan'?' wait':'')});
    svg.appendChild(tri);
    const tx=svgEl('text',{x:p.x,y:p.y-15,class:'ttc-topo-train-label'}); tx.textContent='KA '+kr.nomor; svg.appendChild(tx);
  });

  const bx=W-390, by=20;
  svg.appendChild(svgEl('rect',{x:bx,y:by,width:360,height:52,rx:8,class:'ttc-topo-badge'}));
  const lg=svgEl('text',{x:bx+14,y:by+20,class:'ttc-topo-legend'}); lg.textContent='● Junction   ● Sinyal   ▲ KA   — Rute aktif   — Okupansi'; svg.appendChild(lg);
  const tm=svgEl('text',{x:bx+14,y:by+39,class:'ttc-topo-sub'}); tm.textContent=sim?'Jam simulasi '+(global.TTCJadwal?TTCJadwal.detikKeJam(sim.t,true):'')+' · '+active.length+' KA di lintas':'Simulasi belum dijalankan'; svg.appendChild(tm);
}

function topologyLoop() {
  try {
    const view=$('view-simsinyal');
    if(view && view.classList.contains('active')) renderTopology();
  } catch(e){ console.error('TTC topology visual',e); }
  setTimeout(topologyLoop,300);
}

function init() {
  injectStyle();
  patchGraphRoute();
  patchSimOpCapture();
  patchGapeka();
  topologyLoop();
}

let tries=0;
(function wait(){
  if(global.TTCModel&&global.TTCJadwal&&global.TTCGapeka&&global.TTCSimOp){init();return;}
  if(++tries<100)setTimeout(wait,50);
})();

})(window);
