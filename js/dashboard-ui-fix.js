(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  let categoryChart = null;
  let trendChart = null;

  const colors = {
    blue: "#0B63CE", green: "#12A150", orange: "#F59E0B", red: "#DC3545",
    purple: "#7C3AED", cyan: "#06B6D4", slate: "#475569"
  };

  function parseDate(s) {
    const raw = String(s || "").trim();
    if (!raw) return null;
    const iso = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (iso) return new Date(Number(iso[3]), Number(iso[2]) - 1, Number(iso[1]));
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function keyDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function last7Keys() {
    const out = [];
    const end = new Date();
    end.setHours(0,0,0,0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      out.push(keyDate(d));
    }
    return out;
  }

  function normalizedData() {
    return Array.isArray(window.__dashboardData) ? window.__dashboardData : [];
  }

  function renderTrend(data) {
    const canvas = byId("grafikCanvas");
    if (!canvas || typeof Chart === "undefined") return;
    const keys = last7Keys();
    const counts = Object.fromEntries(keys.map(k => [k, 0]));
    data.forEach(r => {
      const d = parseDate(r.Tanggal || r.tanggal);
      if (!d) return;
      const k = keyDate(d);
      if (k in counts) counts[k]++;
    });
    const labels = keys.map(k => `${k.slice(8)}/${k.slice(5,7)}`);
    const values = keys.map(k => counts[k]);
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(canvas.getContext("2d"), {
      type: "bar",
      data: { labels, datasets: [{ label: "Gangguan", data: values, backgroundColor: colors.blue, borderRadius: 7, maxBarThickness: 34 }] },
      options: { responsive:true, maintainAspectRatio:false, animation:false, plugins:{legend:{display:false},tooltip:{enabled:true}}, scales:{y:{beginAtZero:true,ticks:{precision:0}},x:{grid:{display:false}}} }
    });
    canvas.style.display = "block";
    const empty = byId("grafikEmpty"); if (empty) empty.style.display = values.some(v=>v>0) ? "none" : "block";
    const total = values.reduce((a,b)=>a+b,0);
    const avg = values.length ? (total/values.length).toFixed(1) : "0";
    const first = keys[0], last = keys[keys.length-1];
    const fmt = k => `${k.slice(8)}/${k.slice(5,7)}/${k.slice(0,4)}`;
    const el = byId("grafikPeriode"); if (el) el.textContent = `${fmt(first)} – ${fmt(last)}`;
    const et = byId("grafikTotal"); if (et) et.textContent = total;
    const ea = byId("grafikRata"); if (ea) ea.textContent = avg;
  }

  function renderTopCategories(data) {
    const holder = byId("katList");
    if (!holder) return;
    const counts = {};
    data.forEach(r => {
      const cat = String(r["Kategori Gangguan"] || r.kategori_gangguan || "Tidak diketahui").trim() || "Tidak diketahui";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    const rows = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const max = rows[0]?.[1] || 1;
    holder.innerHTML = rows.length ? rows.map(([name,val],i) => `<div class="cat-row"><div class="cat-name">${name}</div><div class="cat-bar-wrap"><div class="cat-bar" style="width:${Math.max(6,val/max*100)}%;background:${[colors.blue,colors.green,colors.orange,colors.purple,colors.cyan,colors.red,colors.slate,"#E11D48"][i%8]}"></div></div><div class="cat-value">${val}</div></div>`).join("") : "<div class='grafik-empty'>Belum ada data kategori.</div>";
  }

  function applyColors() {
    document.querySelectorAll(".ubin").forEach((el,i)=>{ el.style.borderTop = `4px solid ${[colors.blue,colors.green,colors.orange,colors.purple][i%4]}`; });
    document.querySelectorAll(".grafik-wrap, .blok").forEach(el=>{ el.style.boxShadow = "0 6px 22px rgba(15,23,42,.07)"; });
    const top = document.querySelector(".topbar"); if (top) top.style.borderBottom = `3px solid ${colors.blue}`;
  }

  function boot() {
    applyColors();
    const run = () => {
      const rows = Array.isArray(window.DATA) ? window.DATA : [];
      window.__dashboardData = rows;
      renderTrend(rows);
      renderTopCategories(rows);
    };
    run();
    setTimeout(run, 500);
    setTimeout(run, 1500);
    setInterval(run, 3000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();