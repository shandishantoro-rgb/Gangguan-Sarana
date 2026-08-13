(() => {
  "use strict";

  const API_URL = "https://script.google.com/macros/s/AKfycbzVmjLNsjRTSo6o3gtuGn_3pODvQ35ZQAluMyHZPJw1o_Xi4x4ERWRnNM0tJdY_Hm/exec";
  const ADMIN_USER = "TrainTraffic";
  const ADMIN_PASSWORD_SHA256 = "c75b445cbff8e87cf1a4432649b5b91e5002a10be8e3ba573179753ddc833959";
  const META = "__META__";

  const C = {
    tanggal: "Tanggal", jam: "Jam", noKa: "No KA", relasi: "Relasi", trainset: "Trainset",
    sf: "SF", posisi: "Posisi Kereta", lokasi: "Lokasi", kategori: "Kategori Gangguan",
    uraian: "Uraian Gangguan", tindakan: "Tindakan", dampak: "Dampak", telat: "Keterlambatan",
    dipo: "Dipo", pelapor: "Pelapor", status: "Status", dibuat: "Waktu Input"
  };

  const KATEGORI = [
    "Propulsi / Traksi", "Pengereman", "Pintu Otomatis", "Pantograf", "Kelistrikan Auxiliary",
    "Kelistrikan / Tegangan", "Baterai / Charger", "Bogie & Roda", "Suspensi", "Kopling / Coupler",
    "Pendingin Udara", "Sistem Kontrol / Monitoring", "TCMS", "Mikroprosesor / Kontrol",
    "Interior & Fasilitas", "Lampu", "Kaca & Bodi", "Pintu Kabin", "Announcer / PIS",
    "Radio / Komunikasi", "Wiper", "Sistem Informasi", "Peralatan Keselamatan", "Peralatan Darurat",
    "Kebocoran", "Asap / Bau", "Overheat", "Gangguan Mekanik", "Gangguan Elektrik", "Lain-lain"
  ];
  const DAMPAK = ["Lanjut operasi", "Kecepatan dibatasi", "Sarana diganti", "KA batal", "Masuk dipo", "Masuk balai yasa"];
  const DIPO = ["Depok", "Bogor", "Bukit Duri", "Bekasi", "Cikarang", "Balai Yasa Manggarai"];
  const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  let userRole = null;
  let currentUser = null;
  let DATA = [];
  let editingRow = null;
  let selectedPosition = null;
  let toastTimer = null;
  let chart = null;
  let chartMetric = "jumlah";
  let chartRange = "7";

  const $ = (id) => document.getElementById(id);

  function esc(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toast(message) {
    const el = $("pesan");
    if (!el) return;
    el.textContent = message;
    el.classList.add("tampil");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("tampil"), 2800);
  }

  async function sha256(text) {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
  }

  function normalizeRow(row) {
    let meta = {};
    try {
      const raw = String(row.keterangan || row.Keterangan || "");
      if (raw.startsWith(META)) meta = JSON.parse(raw.slice(META.length));
    } catch (_) {}
    const rowIndex = Number(row.rowIndex || 0);
    return {
      [C.tanggal]: row.Tanggal || "",
      [C.jam]: row.Jam || "",
      [C.noKa]: row["No KA"] || "",
      [C.relasi]: row.Relasi || "",
      [C.trainset]: row.Trainset || "",
      [C.sf]: row.SF || "",
      [C.posisi]: row["Posisi Kereta"] || "",
      [C.lokasi]: row.Lokasi || "",
      [C.kategori]: row.kategori_gangguan || row["Kategori Gangguan"] || "",
      [C.uraian]: row.uraian_gangguan || row["Uraian Gangguan"] || "",
      [C.tindakan]: meta.tindakan || "",
      [C.dampak]: row.dampak || row.Dampak || "",
      [C.telat]: meta.telat || 0,
      [C.dipo]: meta.dipo || "",
      [C.pelapor]: meta.pelapor || "",
      [C.status]: meta.status || "Terbuka",
      [C.dibuat]: meta.dibuat || "",
      _rowIndex: rowIndex
    };
  }

  function packMeta(data) {
    return META + JSON.stringify({
      tindakan: data[C.tindakan] || "",
      telat: data[C.telat] || 0,
      dipo: data[C.dipo] || "",
      pelapor: data[C.pelapor] || "",
      status: data[C.status] || "Terbuka",
      dibuat: data[C.dibuat] || new Date().toISOString()
    });
  }

  async function apiRead() {
    const response = await fetch(API_URL + "?action=read", { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const result = await response.json();
    if (!result.success) throw new Error(result.error || "Gagal membaca data");
    return result.data || [];
  }

  function apiWrite(query) {
    return fetch(API_URL + "?" + query, { mode: "no-cors", cache: "no-store" });
  }

  async function loadData() {
    try {
      DATA = (await apiRead()).map(normalizeRow);
      populateFilters();
      renderAll();
    } catch (error) {
      console.error(error);
      DATA = [];
      populateFilters();
      renderAll();
      toast("Data Google Sheets belum dapat dibaca: " + error.message);
    }
  }

  function populateSelect(id, values, placeholder, selected) {
    const select = $(id);
    if (!select) return;
    select.innerHTML = `<option value="">${esc(placeholder)}</option>` + values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
    if (selected && values.includes(selected)) select.value = selected;
  }

  function populateFormOptions() {
    populateSelect("iDipo", DIPO, "Pilih dipo", $("iDipo")?.value || "");
    populateSelect("iKategori", KATEGORI, "Pilih kategori", $("iKategori")?.value || "");
    populateSelect("iDampak", DAMPAK, "Pilih dampak", $("iDampak")?.value || "");
    setupOtherCategory();
  }

  function setupOtherCategory() {
    const select = $("iKategori");
    if (!select) return;
    if (!$("iKategoriLain")) {
      const input = document.createElement("input");
      input.id = "iKategoriLain";
      input.maxLength = 50;
      input.placeholder = "Tulis singkat, mis. lampu kabin";
      input.style.cssText = "display:none;margin-top:6px;width:100%;padding:8px 10px;border:1px solid #C9CFD9;border-radius:7px";
      select.parentElement.appendChild(input);
      select.addEventListener("change", toggleOtherCategory);
    }
    toggleOtherCategory();
  }

  function toggleOtherCategory() {
    const select = $("iKategori");
    const input = $("iKategoriLain");
    if (!select || !input) return;
    input.style.display = select.value === "Lain-lain" ? "block" : "none";
    if (select.value !== "Lain-lain") input.value = "";
  }

  function categoryValue() {
    const category = $("iKategori")?.value || "";
    if (category === "Lain-lain") {
      const text = $("iKategoriLain")?.value.trim() || "";
      return text ? "Lain-lain: " + text : "Lain-lain";
    }
    return category;
  }

  function populateFilters() {
    const months = [...new Set(DATA.map(r => String(r[C.tanggal] || "").slice(0, 7)).filter(Boolean))].sort().reverse();
    populateSelect("fBulan", months, "Semua periode", $("fBulan")?.value || "");
    populateSelect("fKategori", KATEGORI, "Semua kategori", $("fKategori")?.value || "");
    populateSelect("fDipo", DIPO, "Semua dipo", $("fDipo")?.value || "");
    populateSelect("dbFilterDipo", [...new Set(DATA.map(r => r[C.dipo]).filter(Boolean))].sort(), "Semua dipo", $("dbFilterDipo")?.value || "");
    populateSelect("dbFilterKategori", KATEGORI, "Semua kategori", $("dbFilterKategori")?.value || "");
    populateFormOptions();
  }

  function categoryGroup(value) {
    const s = String(value || "");
    return s.toLowerCase().startsWith("lain-lain:") ? "Lain-lain" : s;
  }

  function filteredDashboard() {
    const q = ($( "fCari")?.value || "").trim().toLowerCase();
    const month = $("fBulan")?.value || "";
    const category = $("fKategori")?.value || "";
    const dipo = $("fDipo")?.value || "";
    const status = $("fStatus")?.value || "";
    return DATA.filter(r => {
      if (month && String(r[C.tanggal] || "").slice(0, 7) !== month) return false;
      if (category && categoryGroup(r[C.kategori]) !== category) return false;
      if (dipo && r[C.dipo] !== dipo) return false;
      if (status && r[C.status] !== status) return false;
      if (q && !Object.values(r).join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function filteredDatabase() {
    const q = ($( "dbCari")?.value || "").trim().toLowerCase();
    const status = $("dbFilterStatus")?.value || "";
    const dipo = $("dbFilterDipo")?.value || "";
    const category = $("dbFilterKategori")?.value || "";
    return DATA.filter(r => {
      if (status && r[C.status] !== status) return false;
      if (dipo && r[C.dipo] !== dipo) return false;
      if (category && categoryGroup(r[C.kategori]) !== category) return false;
      if (q && !Object.values(r).join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function shortDate(v) {
    if (!v) return "—";
    const p = String(v).split("-");
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : v;
  }

  function statusBadge(status) {
    const cls = status === "Selesai" ? "selesai" : status === "Penanganan" ? "penanganan" : "terbuka";
    return `<span class="status-badge ${cls}">${esc(status || "Terbuka")}</span>`;
  }

  function renderDashboard() {
    const rows = filteredDashboard();
    const open = rows.filter(r => r[C.status] !== "Selesai").length;
    const minutes = rows.reduce((sum, r) => sum + (parseInt(r[C.telat], 10) || 0), 0);
    const trainsets = new Set(rows.map(r => r[C.trainset]).filter(Boolean)).size;
    if ($("sTotal")) $("sTotal").textContent = rows.length;
    if ($("sOpen")) $("sOpen").textContent = open;
    if ($("sMenit")) $("sMenit").textContent = minutes;
    if ($("sSet")) $("sSet").textContent = trainsets;
    if ($("countLabel")) $("countLabel").textContent = rows.length + " rekaman";

    const groups = {};
    rows.forEach(r => {
      const key = categoryGroup(r[C.kategori]) || "Tanpa kategori";
      groups[key] = (groups[key] || 0) + 1;
    });
    const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]);
    const max = sorted[0]?.[1] || 1;
    const list = $("katList");
    if (list) {
      list.innerHTML = sorted.length ? sorted.map(([name, count]) => `<div class="kat"><div class="nm">${esc(name)}</div><div class="bar"><i style="width:${Math.round(count / max * 100)}%"></i></div><div class="n">${count}</div></div>`).join("") : `<div style="color:var(--redup);font-size:12px">Tidak ada data.</div>`;
    }

    const body = $("tbody");
    if (body) {
      body.innerHTML = rows.slice(0, 50).map(r => `<tr>
        <td class="num">${esc(shortDate(r[C.tanggal]))}<br>${esc(r[C.jam] || "")}</td>
        <td>${esc(r[C.noKa] || "—")}</td><td>${esc(r[C.trainset] || "—")}</td><td>${esc(r[C.posisi] || "—")}</td>
        <td>${esc(r[C.lokasi] || "—")}</td><td><div class="uraian"><b>${esc(categoryGroup(r[C.kategori]) || "—")}</b>${esc((r[C.uraian] || "").slice(0, 70))}</div></td>
        <td>${esc(r[C.dampak] || "—")}</td><td class="num">${esc(r[C.telat] || 0)}'</td><td>${esc(r[C.dipo] || "—")}</td><td>${statusBadge(r[C.status])}</td>
      </tr>`).join("");
    }
    renderChart(rows);
  }

  function renderDatabase() {
    const rows = filteredDatabase();
    if ($("dbCountLabel")) $("dbCountLabel").textContent = rows.length + " rekaman";
    if ($("dbStatTotal")) $("dbStatTotal").textContent = rows.length;
    if ($("dbStatOpen")) $("dbStatOpen").textContent = rows.filter(r => r[C.status] !== "Selesai").length;
    if ($("dbStatSelesai")) $("dbStatSelesai").textContent = rows.filter(r => r[C.status] === "Selesai").length;
    if ($("dbStatMenit")) $("dbStatMenit").textContent = rows.reduce((s, r) => s + (parseInt(r[C.telat], 10) || 0), 0);
    const body = $("dbTbody");
    if (!body) return;
    body.innerHTML = rows.map((r, i) => `<tr ${userRole === "admin" ? `data-row="${i}"` : ""}>
      <td>${i + 1}</td><td>${esc(shortDate(r[C.tanggal]))}</td><td>${esc(r[C.jam] || "")}</td><td>${esc(r[C.noKa] || "")}</td>
      <td>${esc(r[C.trainset] || "")}</td><td>${esc(r[C.sf] || "")}</td><td>${esc(r[C.posisi] || "")}</td><td>${esc(r[C.lokasi] || "")}</td>
      <td>${esc(categoryGroup(r[C.kategori]))}</td><td>${esc((r[C.uraian] || "").slice(0, 60))}</td><td>${esc(r[C.dampak] || "")}</td>
      <td>${esc(r[C.telat] || 0)}'</td><td>${esc(r[C.dipo] || "")}</td><td>${statusBadge(r[C.status])}</td><td>${esc(r[C.pelapor] || "")}</td>
    </tr>`).join("");
    if ($("dbKosong")) $("dbKosong").hidden = rows.length > 0;
    if (userRole === "admin") body.querySelectorAll("tr[data-row]").forEach(tr => tr.addEventListener("click", () => openForm(rows[Number(tr.dataset.row)])));
  }

  function renderChart(rows) {
    if (typeof Chart === "undefined" || !$("grafikCanvas")) return;
    let selected = rows.slice();
    if (chartRange !== "all") {
      const days = Number(chartRange);
      const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - days + 1);
      selected = selected.filter(r => new Date((r[C.tanggal] || "") + "T00:00:00") >= from);
    }
    const map = {};
    selected.forEach(r => {
      const key = r[C.tanggal] || "Tanpa tanggal";
      map[key] = (map[key] || 0) + (chartMetric === "menit" ? (parseInt(r[C.telat], 10) || 0) : 1);
    });
    const labels = Object.keys(map).sort();
    const values = labels.map(k => map[k]);
    if ($("grafikPeriode")) $("grafikPeriode").textContent = labels.length ? (labels.length === 1 ? shortDate(labels[0]) : shortDate(labels[0]) + "–" + shortDate(labels[labels.length - 1])) : "-";
    if ($("grafikTotal")) $("grafikTotal").textContent = values.reduce((a, b) => a + b, 0);
    if ($("grafikRata")) $("grafikRata").textContent = values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : "0";
    if (chart) chart.destroy();
    if (!labels.length) return;
    chart = new Chart($("grafikCanvas"), { type: "line", data: { labels: labels.map(shortDate), datasets: [{ data: values, borderColor: "#302B78", backgroundColor: "rgba(48,43,120,.08)", fill: true, tension: .25 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  }

  function clock() {
    const d = new Date();
    if ($("jamNow")) $("jamNow").textContent = [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, "0")).join(":");
    if ($("tglNow")) $("tglNow").textContent = `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
  }

  function openForm(row = null) {
    if (row && userRole !== "admin") return;
    editingRow = row;
    populateFormOptions();
    if (row) {
      $("laciJudul").textContent = "Edit laporan gangguan";
      $("iTanggal").value = row[C.tanggal] || "";
      $("iJam").value = row[C.jam] || "";
      $("iNoKa").value = row[C.noKa] || "";
      $("iRelasi").value = row[C.relasi] || "";
      $("iTrainset").value = row[C.trainset] || "";
      $("iSf").value = row[C.sf] || "12";
      $("iLokasi").value = row[C.lokasi] || "";
      $("iDipo").value = row[C.dipo] || "";
      $("iDampak").value = row[C.dampak] || "";
      $("iTelat").value = row[C.telat] || 0;
      $("iStatus").value = row[C.status] || "Terbuka";
      $("iPelapor").value = row[C.pelapor] || "";
      $("iUraian").value = row[C.uraian] || "";
      $("iTindakan").value = row[C.tindakan] || "";
      const rawCat = row[C.kategori] || "";
      if (rawCat.toLowerCase().startsWith("lain-lain:")) { $("iKategori").value = "Lain-lain"; setupOtherCategory(); $("iKategoriLain").value = rawCat.slice(rawCat.indexOf(":") + 1).trim(); }
      else $("iKategori").value = rawCat;
      selectedPosition = row[C.posisi] ? Number(row[C.posisi]) : null;
      $("btnHapus").style.display = "inline-block";
    } else {
      $("laciJudul").textContent = "Laporan gangguan baru";
      const now = new Date();
      $("iTanggal").value = now.toISOString().slice(0, 10);
      $("iJam").value = now.toTimeString().slice(0, 5);
      $("iNoKa").value = ""; $("iRelasi").value = ""; $("iTrainset").value = ""; $("iSf").value = "8";
      $("iLokasi").value = ""; $("iDipo").value = ""; $("iKategori").value = ""; $("iDampak").value = ""; $("iTelat").value = 0;
      $("iStatus").value = "Terbuka"; $("iPelapor").value = currentUser || ""; $("iUraian").value = ""; $("iTindakan").value = "";
      if ($("iKategoriLain")) $("iKategoriLain").value = "";
      $("btnHapus").style.display = "none";
      selectedPosition = null;
    }
    drawPositionStrip();
    $("tirai").classList.add("buka");
    $("laci").classList.add("buka");
  }

  function closeForm() { $("tirai")?.classList.remove("buka"); $("laci")?.classList.remove("buka"); editingRow = null; }

  function drawPositionStrip() {
    const wrap = $("stripForm");
    if (!wrap) return;
    const count = Number($("iSf")?.value || 8);
    if (selectedPosition && selectedPosition > count) selectedPosition = null;
    wrap.innerHTML = `<span class="arah">◀ 1</span>` + Array.from({ length: count }, (_, i) => i + 1).map(n => `<button type="button" class="k${n === selectedPosition ? " aktif" : ""}" data-pos="${n}">${n}</button>`).join("") + `<span class="arah">${count} ▶</span>`;
    wrap.querySelectorAll("[data-pos]").forEach(btn => btn.addEventListener("click", () => { selectedPosition = Number(btn.dataset.pos); drawPositionStrip(); }));
  }

  function formData() {
    return {
      [C.tanggal]: $("iTanggal").value,
      [C.jam]: $("iJam").value,
      [C.noKa]: $("iNoKa").value.trim(),
      [C.relasi]: $("iRelasi").value.trim(),
      [C.trainset]: $("iTrainset").value.trim(),
      [C.sf]: $("iSf").value,
      [C.posisi]: selectedPosition ? String(selectedPosition) : "",
      [C.lokasi]: $("iLokasi").value.trim(),
      [C.kategori]: categoryValue(),
      [C.uraian]: $("iUraian").value.trim(),
      [C.tindakan]: $("iTindakan").value.trim(),
      [C.dampak]: $("iDampak").value,
      [C.telat]: $("iTelat").value || 0,
      [C.dipo]: $("iDipo").value,
      [C.pelapor]: $("iPelapor").value.trim(),
      [C.status]: $("iStatus").value,
      [C.dibuat]: new Date().toISOString()
    };
  }

  function queryCreate(data) {
    return new URLSearchParams({ action: "create", tanggal: data[C.tanggal], jam: data[C.jam], no_ka: data[C.noKa], relasi: data[C.relasi], trainset: data[C.trainset], sf: data[C.sf], posisi_kereta: data[C.posisi], lokasi: data[C.lokasi], kategori_gangguan: data[C.kategori], uraian_gangguan: data[C.uraian], dampak: data[C.dampak], keterangan: packMeta(data) }).toString();
  }

  async function saveForm() {
    const data = formData();
    if (!data[C.tanggal] || !data[C.noKa] || !data[C.trainset] || !data[C.kategori]) {
      toast("Lengkapi tanggal, Nomor KA, trainset, dan kategori gangguan.");
      return;
    }
    if (editingRow && userRole !== "admin") {
      toast("User hanya dapat membuat laporan baru.");
      return;
    }
    try {
      if (editingRow) {
        const params = new URLSearchParams({ action: "update", rowIndex: editingRow._rowIndex, kategori_gangguan: data[C.kategori], uraian_gangguan: data[C.uraian], dampak: data[C.dampak], keterangan: packMeta(data) });
        await apiWrite(params.toString());
      } else {
        await apiWrite(queryCreate(data));
      }
      toast("Permintaan penyimpanan dikirim ke Google Sheets.");
      closeForm();
      setTimeout(loadData, 1200);
    } catch (error) {
      console.error(error);
      toast("Gagal mengirim data: " + error.message);
    }
  }

  async function deleteRow(row) {
    if (userRole !== "admin" || !row?._rowIndex) return;
    if (!confirm("Hapus laporan " + (row[C.noKa] || "") + "?")) return;
    try {
      await apiWrite(`action=delete&rowIndex=${encodeURIComponent(row._rowIndex)}`);
      toast("Permintaan hapus dikirim ke Google Sheets.");
      setTimeout(loadData, 900);
    } catch (error) {
      toast("Gagal menghapus data: " + error.message);
    }
  }

  function login() {
    const role = document.querySelector('input[name="role"]:checked')?.value || "user";
    const username = $("username")?.value.trim();
    const password = $("password")?.value || "";
    const error = $("loginError");
    if (!username) { error.textContent = "Silakan isi " + (role === "admin" ? "username" : "nama pengguna"); error.style.display = "block"; return; }
    const proceed = () => {
      currentUser = username; userRole = role;
      $("userRole").textContent = (role === "admin" ? "Admin: " : "User: ") + username;
      $("sidebarUserName").textContent = username; $("sidebarUserRole").textContent = role === "admin" ? "Admin" : "User";
      $("btnBaru").style.display = "block"; $("btnBaruDb").style.display = "block"; $("btnSimpan").style.display = "block"; $("btnDbCsv").style.display = role === "admin" ? "inline-block" : "none";
      $("loginScreen").classList.add("hidden"); $("dashboardScreen").classList.add("visible"); clock(); loadData();
    };
    error.style.display = "none";
    if (role === "admin") sha256(password).then(hash => { if (username !== ADMIN_USER || hash !== ADMIN_PASSWORD_SHA256) { error.textContent = "Username atau password salah"; error.style.display = "block"; } else proceed(); });
    else proceed();
  }

  function bindUI() {
    $("loginBtn")?.addEventListener("click", login);
    $("logoutBtn")?.addEventListener("click", () => location.reload());
    $("roleAdmin")?.addEventListener("change", () => { $("label1").textContent = "Username"; $("passwordField").style.display = "block"; });
    $("roleUser")?.addEventListener("change", () => { $("label1").textContent = "Nama Pengguna"; $("passwordField").style.display = "none"; });
    $("btnBaru")?.addEventListener("click", () => openForm());
    $("btnBaruDb")?.addEventListener("click", () => openForm());
    $("btnTutup")?.addEventListener("click", closeForm); $("btnBatal")?.addEventListener("click", closeForm); $("tirai")?.addEventListener("click", closeForm);
    $("btnSimpan")?.addEventListener("click", saveForm);
    $("btnHapus")?.addEventListener("click", () => deleteRow(editingRow));
    $("iSf")?.addEventListener("change", drawPositionStrip);
    $("btnMuat")?.addEventListener("click", loadData);
    ["fCari","fBulan","fKategori","fDipo","fStatus"].forEach(id => $(id)?.addEventListener("input", renderAll));
    ["dbCari","dbFilterStatus","dbFilterDipo","dbFilterKategori"].forEach(id => $(id)?.addEventListener("input", renderDatabase));
    $("btnDbReset")?.addEventListener("click", () => { ["dbCari","dbFilterStatus","dbFilterDipo","dbFilterKategori"].forEach(id => { if ($(id)) $(id).value = ""; }); renderDatabase(); });
    $("menuToggle")?.addEventListener("click", () => { $("sidebar")?.classList.toggle("buka"); $("sidebarOverlay")?.classList.toggle("buka"); });
    $("sidebarOverlay")?.addEventListener("click", () => { $("sidebar")?.classList.remove("buka"); $("sidebarOverlay")?.classList.remove("buka"); });
    document.querySelectorAll(".sidebar-nav .nav-item").forEach(btn => btn.addEventListener("click", () => {
      document.querySelectorAll(".sidebar-nav .nav-item").forEach(x => x.classList.remove("aktif")); btn.classList.add("aktif");
      document.querySelectorAll(".view").forEach(x => x.classList.remove("aktif")); $("view" + btn.dataset.view.charAt(0).toUpperCase() + btn.dataset.view.slice(1))?.classList.add("aktif");
      if (btn.dataset.view === "database") renderDatabase();
    }));
    ["grafikTabJumlah","grafikTabMenit"].forEach(id => $(id)?.addEventListener("click", () => { chartMetric = id === "grafikTabMenit" ? "menit" : "jumlah"; renderChart(filteredDashboard()); }));
    document.querySelectorAll(".grafik-range[data-range]").forEach(btn => btn.addEventListener("click", () => { document.querySelectorAll(".grafik-range").forEach(x => x.classList.remove("aktif")); btn.classList.add("aktif"); chartRange = btn.dataset.range; renderChart(filteredDashboard()); }));
    $("grafikReset")?.addEventListener("click", () => { chartRange = "7"; chartMetric = "jumlah"; document.querySelectorAll(".grafik-range").forEach(x => x.classList.remove("aktif")); document.querySelector('.grafik-range[data-range="7"]')?.classList.add("aktif"); renderChart(filteredDashboard()); });
  }

  function renderAll() { renderDashboard(); renderDatabase(); }

  function boot() {
    bindUI();
    populateFormOptions();
    drawPositionStrip();
    clock();
    setInterval(clock, 1000);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();