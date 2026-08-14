(() => {
  "use strict";

  const byId = id => document.getElementById(id);
  let trendChart = null;

  const colors = ["#0B63CE", "#12A150", "#F59E0B", "#7C3AED", "#06B6D4", "#DC3545", "#475569", "#E11D48"];

  function parseDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function keyDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function last7Keys() {
    const out = [];
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      out.push(keyDate(d));
    }
    return out;
  }

  function getRows() {
    try {
      const raw = sessionStorage.getItem("gsdata");
      const rows = raw ? JSON.parse(raw) : [];
      return Array.isArray(rows) ? rows : [];
    } catch (_) {
      return [];
    }
  }

  function renderTrend(data) {
    const canvas = byId("grafikCanvas");
    if (!canvas || typeof Chart === "undefined") return;

    const keys = last7Keys();
    const counts = Object.fromEntries(keys.map(k => [k, 0]));

    data.forEach(row => {
      const d = parseDate(row["Tanggal"]);
      if (!d) return;
      const k = keyDate(d);
      if (k in counts) counts[k]++;
    });

    const labels = keys.map(k => `${k.slice(8)}/${k.slice(5, 7)}`);
    const values = keys.map(k => counts[k]);

    if (trendChart) trendChart.destroy();
    trendChart = new Chart(canvas.getContext("2d"), {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Gangguan",
          data: values,
          backgroundColor: "#0B63CE",
          borderRadius: 7,
          maxBarThickness: 34
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
          x: { grid: { display: false } }
        }
      }
    });

    canvas.style.display = "block";
    const empty = byId("grafikEmpty");
    if (empty) empty.style.display = values.some(v => v > 0) ? "none" : "block";

    const total = values.reduce((a, b) => a + b, 0);
    const avg = (total / 7).toFixed(1);
    const fmt = k => `${k.slice(8)}/${k.slice(5, 7)}/${k.slice(0, 4)}`;
    if (byId("grafikPeriode")) byId("grafikPeriode").textContent = `${fmt(keys[0])} – ${fmt(keys[6])}`;
    if (byId("grafikTotal")) byId("grafikTotal").textContent = total;
    if (byId("grafikRata")) byId("grafikRata").textContent = avg;
  }

  function renderTopCategories(data) {
    const holder = byId("katList");
    if (!holder) return;

    const counts = {};
    data.forEach(row => {
      const category = String(row["Kategori Gangguan"] || row.kategori_gangguan || "Tidak diketahui").trim() || "Tidak diketahui";
      counts[category] = (counts[category] || 0) + 1;
    });

    const rows = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    if (!rows.length) {
      holder.innerHTML = `<div style="padding:28px;text-align:center;color:#94a3b8">Belum ada data gangguan.</div>`;
      return;
    }

    const max = rows[0][1];
    holder.innerHTML = rows.map(([name, value], index) => {
      const pct = Math.max(6, Math.round((value / max) * 100));
      const color = colors[index % colors.length];
      return `
        <div style="display:grid;grid-template-columns:190px minmax(140px,1fr) 48px;gap:14px;align-items:center;margin:14px 0">
          <div style="font-weight:600;color:#243043;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${name}">${name}</div>
          <div style="height:18px;background:#edf2f7;border-radius:999px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(15,23,42,.06)">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:999px;transition:width .35s ease"></div>
          </div>
          <div style="font-weight:800;color:${color};text-align:right;font-size:15px">${value}</div>
        </div>`;
    }).join("");
  }

  function applyColors() {
    document.querySelectorAll(".ubin").forEach((el, i) => {
      el.style.borderTop = `4px solid ${colors[i % 4]}`;
    });
    document.querySelectorAll(".grafik-wrap, .blok").forEach(el => {
      el.style.boxShadow = "0 6px 22px rgba(15,23,42,.07)";
    });
    const top = document.querySelector(".topbar");
    if (top) top.style.borderBottom = "3px solid #0B63CE";
  }

  function boot() {
    applyColors();
    const run = () => {
      const rows = getRows();
      renderTrend(rows);
      renderTopCategories(rows);
    };
    run();
    setTimeout(run, 400);
    setTimeout(run, 1200);
    setTimeout(run, 2500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();