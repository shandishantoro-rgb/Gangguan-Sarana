(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  function readData() {
    try {
      const data = JSON.parse(sessionStorage.getItem("gsdata") || "[]");
      return Array.isArray(data) ? data : [];
    } catch (_) {
      return [];
    }
  }

  function toIsoDate(value) {
    const s = String(value ?? "").trim();
    if (!s) return "";
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    return s.slice(0, 10);
  }

  function formatLabel(iso) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}`;
  }

  function getDefaults(data) {
    const dates = data.map(r => toIsoDate(r["Tanggal"])).filter(Boolean).sort();
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 13);
    const startDefault = startDate.toISOString().slice(0, 10);
    return {
      start: dates.length ? Math.min(dates[0], startDefault) : startDefault,
      end: dates.length ? Math.max(dates[dates.length - 1], end) : end
    };
  }

  function render() {
    const trend = $("trend");
    const startEl = $("trendStart");
    const endEl = $("trendEnd");
    const empty = $("grafikEmpty");
    const periode = $("grafikPeriode");
    const totalEl = $("grafikTotal");
    const rataEl = $("grafikRata");
    if (!trend || !startEl || !endEl) return;

    const data = readData();
    const defaults = getDefaults(data);
    if (!startEl.value) startEl.value = defaults.start;
    if (!endEl.value) endEl.value = defaults.end;

    const start = startEl.value;
    const end = endEl.value;

    if (start > end) {
      trend.innerHTML = "";
      if (periode) periode.textContent = "Tanggal tidak valid";
      if (totalEl) totalEl.textContent = "0";
      if (rataEl) rataEl.textContent = "0";
      if (empty) { empty.hidden = false; empty.textContent = "Tanggal mulai tidak boleh lebih besar dari tanggal akhir."; }
      return;
    }

    const current = data.filter(row => {
      const d = toIsoDate(row["Tanggal"]);
      return d && d >= start && d <= end;
    });

    const days = {};
    for (const row of current) {
      const d = toIsoDate(row["Tanggal"]);
      if (d) days[d] = (days[d] || 0) + 1;
    }

    // Tampilkan setiap hari dalam rentang, termasuk hari dengan 0 gangguan.
    const dates = [];
    const cursor = new Date(`${start}T00:00:00`);
    const finish = new Date(`${end}T00:00:00`);
    while (cursor <= finish) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }

    const values = dates.map(d => days[d] || 0);
    const max = Math.max(1, ...values);
    trend.innerHTML = dates.map((date, i) => `
      <div class="barwrap">
        <div class="barvalue">${values[i]}</div>
        <div class="bar" style="height:${Math.max(4, (values[i] / max) * 150)}px" title="${date}: ${values[i]} gangguan"></div>
        <div class="barlabel">${formatLabel(date)}</div>
      </div>
    `).join("");

    const total = values.reduce((a, b) => a + b, 0);
    const avg = dates.length ? (total / dates.length) : 0;
    if (periode) periode.textContent = `${formatLabel(start)} - ${formatLabel(end)}`;
    if (totalEl) totalEl.textContent = total;
    if (rataEl) rataEl.textContent = avg.toFixed(1);
    if (empty) empty.hidden = current.length !== 0;
  }

  function init() {
    const start = $("trendStart");
    const end = $("trendEnd");
    if (!start || !end) return;

    [start, end].forEach(el => el.addEventListener("change", render));

    const reset = $("grafikReset");
    if (reset) reset.addEventListener("click", () => {
      const data = readData();
      const d = getDefaults(data);
      start.value = d.start;
      end.value = d.end;
      render();
    });

    // App.js menyimpan data ke sessionStorage setelah READ.
    render();
    window.addEventListener("storage", render);
    setTimeout(render, 150);
    setTimeout(render, 700);
    setTimeout(render, 1500);
  }

  window.addEventListener("DOMContentLoaded", init);
})();
