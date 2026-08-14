(() => {
  "use strict";

  const API_URL = "https://script.google.com/macros/s/AKfycbzVmjLNsjRTSo6o3gtuGn_3pODvQ35ZQAluMyHZPJw1o_Xi4x4ERWRnNM0tJdY_Hm/exec";
  const ADMIN_USER = "TrainTraffic";
  const ADMIN_PASSWORD_SHA256 = "c75b445cbff8e87cf1a4432649b5b91e5002a10be8e3ba573179753ddc833959";

  const C = {
    id: "ID", tanggal: "Tanggal", jam: "Jam", noKa: "No KA", relasi: "Relasi",
    trainset: "Trainset", sf: "SF", posisi: "Posisi Kereta", lokasi: "Lokasi",
    kategori: "Kategori Gangguan", uraian: "Uraian Gangguan", tindakan: "Tindakan",
    dampak: "Dampak", telat: "Keterlambatan", dipo: "Dipo", pelapor: "Pelapor",
    status: "Status", dibuat: "Waktu Input"
  };

  const KATEGORI = [
    "Propulsi / Traksi", "Pengereman", "Pintu Otomatis", "Pantograf",
    "Kelistrikan Auxiliary", "Kelistrikan / Tegangan", "Baterai / Charger",
    "Bogie & Roda", "Suspensi", "Kopling / Coupler", "Pendingin Udara",
    "Sistem Kontrol / Monitoring", "TCMS", "Mikroprosesor / Kontrol",
    "Interior & Fasilitas", "Lampu", "Kaca & Bodi", "Pintu Kabin",
    "Announcer / PIS", "Radio / Komunikasi", "Wiper", "Sistem Informasi",
    "Peralatan Keselamatan", "Peralatan Darurat", "Kebocoran", "Asap / Bau",
    "Overheat", "Gangguan Mekanik", "Gangguan Elektrik", "Lain-lain"
  ];

  const DAMPAK = ["Lanjut operasi", "Kecepatan dibatasi", "Sarana diganti", "KA batal", "Masuk dipo", "Masuk balai yasa"];
  const DIPO = ["Depok", "Bogor", "Bukit Duri", "Bekasi", "Cikarang", "Balai Yasa Manggarai"];

  let currentUser = "";
  let userRole = "";
  let DATA = [];
  let editingId = null;
  let selectedPosition = null;
  let jsonpSeq = 0;

  const $ = (id) => document.querySelector(id);
  const byId = (id) => document.getElementById(id);

  function esc(value) {
    return String(value ?? "").replace(/[&<>\"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    }[m]));
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value;
  }

  function toast(message) {
    const el = byId("pesan");
    if (!el) return;
    el.textContent = message;
    el.classList.add("tampil");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("tampil"), 3000);
  }

  async function sha256(text) {
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function saveSession() {
    sessionStorage.setItem("gssession", JSON.stringify({ user: currentUser, role: userRole }));
  }

  function loadSession() {
    try {
      const saved = JSON.parse(sessionStorage.getItem("gssession") || "null");
      if (saved && saved.user && saved.role) {
        currentUser = saved.user;
        userRole = saved.role;
        return true;
      }
    } catch (_) {}
    return false;
  }

  function clearSession() {
    sessionStorage.removeItem("gssession");
  }

  function setRoleUI() {
    setText("userRole", (userRole === "admin" ? "Admin: " : "User: ") + currentUser);
    setText("sidebarUserName", currentUser);
    setText("sidebarUserRole", userRole === "admin" ? "Admin" : "User");

    const btnBaru = byId("btnBaru");
    const btnBaruDb = byId("btnBaruDb");
    const btnSimpan = byId("btnSimpan");
    const btnHapus = byId("btnHapus");
    const btnDbCsv = byId("btnDbCsv");

    if (btnBaru) btnBaru.style.display = "block";
    if (btnBaruDb) btnBaruDb.style.display = "block";
    if (btnSimpan) btnSimpan.style.display = "block";
    if (btnHapus) btnHapus.style.display = "none";
    if (btnDbCsv) btnDbCsv.style.display = userRole === "admin" ? "inline-flex" : "none";
  }

  function showLogin() {
    const login = byId("loginScreen");
    const dash = byId("dashboardScreen");
    if (login) login.classList.remove("hidden");
    if (dash) dash.classList.remove("visible");
  }

  function showDashboard() {
    const login = byId("loginScreen");
    const dash = byId("dashboardScreen");
    if (login) login.classList.add("hidden");
    if (dash) dash.classList.add("visible");
    setRoleUI();
    populateOptions();
    updateClock();
    if (!showDashboard.timer) showDashboard.timer = setInterval(updateClock, 1000);
    loadData();
  }

  async function login() {
    const selected = document.querySelector('input[name="role"]:checked');
    const role = selected ? selected.value : "user";
    const username = (byId("username")?.value || "").trim();
    const password = byId("password")?.value || "";
    const error = byId("loginError");

    if (error) {
      error.style.display = "none";
      error.textContent = "";
    }

    if (!username) {
      if (error) {
        error.textContent = role === "admin" ? "Silakan isi username" : "Silakan isi nama pengguna";
        error.style.display = "block";
      }
      return;
    }

    if (role === "admin") {
      const hash = await sha256(password);
      if (username !== ADMIN_USER || hash !== ADMIN_PASSWORD_SHA256) {
        if (error) {
          error.textContent = "Username atau password salah";
          error.style.display = "block";
        }
        return;
      }
    }

    currentUser = username;
    userRole = role;
    saveSession();
    showDashboard();
  }

  function logout() {
    currentUser = "";
    userRole = "";
    DATA = [];
    editingId = null;
    clearSession();
    if (byId("username")) byId("username").value = "";
    if (byId("password")) byId("password").value = "";
    if (byId("roleAdmin")) byId("roleAdmin").checked = true;
    if (byId("passwordField")) byId("passwordField").style.display = "block";
    showLogin();
  }

  function updateClock() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const bulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    setText("jamNow", `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
    setText("tglNow", `${hari[d.getDay()]}, ${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`);
  }

  function jsonp(params) {
    return new Promise((resolve, reject) => {
      const callbackName = `__gss_cb_${Date.now()}_${++jsonpSeq}`;
      const script = document.createElement("script");
      const query = new URLSearchParams({ ...params, callback: callbackName }).toString();
      let done = false;
      const cleanup = () => {
        try { delete window[callbackName]; } catch (_) {}
        script.remove();
      };
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error("API timeout"));
      }, 15000);
      window[callbackName] = (data) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        cleanup();
        resolve(data);
      };
      script.onerror = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        cleanup();
        reject(new Error("Gagal menghubungi Google Sheets API"));
      };
      script.src = `${API_URL}?${query}`;
      document.head.appendChild(script);
    });
  }

  function mapRow(row) {
    let meta = {};
    try {
      const raw = String(row.keterangan || row.Keterangan || "");
      if (raw.indexOf("__META__") === 0) meta = JSON.parse(raw.slice(8));
    } catch (_) {}

    const rowIndex = Number(row.rowIndex || 0);
    return {
      [C.id]: `gs-${rowIndex}`,
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

  async function loadData() {
    try {
      const result = await jsonp({ action: "read" });
      if (!result || !result.success) throw new Error(result?.error || "Gagal membaca Google Sheets");
      DATA = (result.data || []).map(mapRow);
      sessionStorage.setItem("gsdata", JSON.stringify(DATA));
      renderAll();
    } catch (error) {
      try { DATA = JSON.parse(sessionStorage.getItem("gsdata") || "[]"); } catch (_) { DATA = []; }
      renderAll();
      toast(DATA.length ? "Google Sheets gagal dibaca; menampilkan cache terakhir" : error.message);
      console.error(error);
    }
  }

  function packMeta(data) {
    return "__META__" + JSON.stringify({
      tindakan: data[C.tindakan] || "",
      telat: data[C.telat] || 0,
      dipo: data[C.dipo] || "",
      pelapor: data[C.pelapor] || "",
      status: data[C.status] || "Terbuka",
      dibuat: data[C.dibuat] || new Date().toISOString()
    });
  }

  async function saveReport() {
    const data = readForm();
    if (!data[C.tanggal] || !data[C.noKa] || !data[C.trainset] || !data[C.kategori]) {
      toast("Lengkapi tanggal, No KA, trainset, dan kategori.");
      return;
    }

    if (editingId && userRole !== "admin") {
      toast("User hanya dapat membuat laporan baru.");
      return;
    }

    try {
      let result;
      if (editingId) {
        const row = DATA.find((x) => x[C.id] === editingId);
        if (!row) throw new Error("Data tidak ditemukan");
        result = await jsonp({
          action: "update",
          rowIndex: row._rowIndex,
          kategori_gangguan: data[C.kategori],
          uraian_gangguan: data[C.uraian],
          dampak: data[C.dampak],
          keterangan: packMeta(data)
        });
      } else {
        result = await jsonp({
          action: "create",
          tanggal: data[C.tanggal], jam: data[C.jam], no_ka: data[C.noKa], relasi: data[C.relasi],
          trainset: data[C.trainset], sf: data[C.sf], posisi_kereta: data[C.posisi], lokasi: data[C.lokasi],
          kategori_gangguan: data[C.kategori], uraian_gangguan: data[C.uraian], dampak: data[C.dampak],
          keterangan: packMeta(data)
        });
      }

      if (!result || !result.success) throw new Error(result?.error || "Google Sheets menolak penyimpanan");
      closeDrawer();
      toast("Data berhasil disimpan");
      await loadData();
    } catch (error) {
      console.error(error);
      toast(error.message);
    }
  }

  async function deleteReport(row) {
    if (userRole !== "admin" || !row) return;
    if (!confirm(`Hapus laporan ${row[C.noKa] || ""} / ${row[C.trainset] || ""}?`)) return;
    try {
      const result = await jsonp({ action: "delete", rowIndex: row._rowIndex });
      if (!result || !result.success) throw new Error(result?.error || "Gagal menghapus data");
      toast("Data berhasil dihapus");
      await loadData();
    } catch (error) {
      toast(error.message);
    }
  }

  function populateSelect(id, items, first) {
    const select = byId(id);
    if (!select) return;
    select.innerHTML = `<option value="">${esc(first)}</option>` + items.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join("");
  }

  function populateOptions() {
    populateSelect("iKategori", KATEGORI, "Pilih kategori");
    populateSelect("iDipo", DIPO, "Pilih dipo");
    populateSelect("iDampak", DAMPAK, "Pilih dampak");
    ensureOtherCategory();
    renderPositionStrip();
  }

  function ensureOtherCategory() {
    const select = byId("iKategori");
    if (!select || byId("iKategoriLain")) return;
    const input = document.createElement("input");
    input.id = "iKategoriLain";
    input.type = "text";
    input.maxLength = 60;
    input.placeholder = "Tulis singkat, mis. lampu kabin";
    input.style.cssText = "display:none;margin-top:6px;width:100%;padding:8px 10px;border:1px solid #C9CFD9;border-radius:7px";
    select.parentElement.appendChild(input);
    select.addEventListener("change", () => {
      input.style.display = select.value === "Lain-lain" ? "block" : "none";
      if (select.value !== "Lain-lain") input.value = "";
    });
  }

  function renderPositionStrip() {
    const sf = byId("iSf");
    const strip = byId("stripForm");
    if (!sf || !strip) return;
    const count = Number(sf.value || 8);
    if (selectedPosition > count) selectedPosition = null;
    let html = `<span class="arah">◀ 1</span>`;
    for (let i = 1; i <= count; i++) html += `<span class="k${selectedPosition === i ? " aktif" : ""}" data-pos="${i}" role="button" tabindex="0">${i}</span>`;
    html += `<span class="arah">${count} ▶</span>`;
    strip.innerHTML = html;
    strip.querySelectorAll(".k").forEach((node) => {
      const choose = () => { selectedPosition = Number(node.dataset.pos); renderPositionStrip(); };
      node.addEventListener("click", choose);
      node.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); }
      });
    });
  }

  function readForm() {
    let category = byId("iKategori")?.value || "";
    if (category === "Lain-lain") {
      const extra = byId("iKategoriLain")?.value.trim() || "";
      category = extra ? `Lain-lain: ${extra}` : "Lain-lain";
    }
    return {
      [C.tanggal]: byId("iTanggal")?.value || "",
      [C.jam]: byId("iJam")?.value || "",
      [C.noKa]: byId("iNoKa")?.value.trim() || "",
      [C.relasi]: byId("iRelasi")?.value.trim() || "",
      [C.trainset]: byId("iTrainset")?.value.trim() || "",
      [C.sf]: byId("iSf")?.value || "8",
      [C.posisi]: selectedPosition || "",
      [C.lokasi]: byId("iLokasi")?.value.trim() || "",
      [C.kategori]: category,
      [C.uraian]: byId("iUraian")?.value.trim() || "",
      [C.tindakan]: byId("iTindakan")?.value.trim() || "",
      [C.dampak]: byId("iDampak")?.value || "",
      [C.telat]: byId("iTelat")?.value || 0,
      [C.dipo]: byId("iDipo")?.value || "",
      [C.pelapor]: byId("iPelapor")?.value.trim() || currentUser,
      [C.status]: byId("iStatus")?.value || "Terbuka",
      [C.dibuat]: new Date().toISOString()
    };
  }

  function resetForm() {
    editingId = null;
    selectedPosition = null;
    const now = new Date();
    if (byId("iTanggal")) byId("iTanggal").value = now.toISOString().slice(0, 10);
    if (byId("iJam")) byId("iJam").value = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    ["iNoKa", "iRelasi", "iTrainset", "iLokasi", "iUraian", "iTindakan"].forEach((id) => { if (byId(id)) byId(id).value = ""; });
    if (byId("iSf")) byId("iSf").value = "8";
    if (byId("iTelat")) byId("iTelat").value = "0";
    if (byId("iStatus")) byId("iStatus").value = "Terbuka";
    if (byId("iPelapor")) byId("iPelapor").value = currentUser;
    if (byId("iKategori")) byId("iKategori").value = "";
    if (byId("iKategoriLain")) { byId("iKategoriLain").value = ""; byId("iKategoriLain").style.display = "none"; }
    populateOptions();
    if (byId("laciJudul")) byId("laciJudul").textContent = "Laporan gangguan baru";
    if (byId("btnHapus")) byId("btnHapus").style.display = "none";
  }

  function openDrawer(row) {
    editingId = row ? row[C.id] : null;
    populateOptions();
    const drawer = byId("laci");
    const overlay = byId("tirai");
    if (row) {
      const set = (id, value) => { if (byId(id)) byId(id).value = value ?? ""; };
      set("iTanggal", row[C.tanggal]); set("iJam", row[C.jam]); set("iNoKa", row[C.noKa]); set("iRelasi", row[C.relasi]);
      set("iTrainset", row[C.trainset]); set("iSf", row[C.sf] || 8); set("iLokasi", row[C.lokasi]); set("iDampak", row[C.dampak]);
      set("iTelat", row[C.telat] || 0); set("iDipo", row[C.dipo]); set("iStatus", row[C.status] || "Terbuka");
      set("iPelapor", row[C.pelapor] || currentUser); set("iUraian", row[C.uraian]); set("iTindakan", row[C.tindakan]);
      const other = String(row[C.kategori] || "");
      if (other.indexOf("Lain-lain:") === 0) {
        byId("iKategori").value = "Lain-lain";
        byId("iKategoriLain").style.display = "block";
        byId("iKategoriLain").value = other.slice(10).trim();
      } else {
        byId("iKategori").value = other;
      }
      selectedPosition = Number(row[C.posisi]) || null;
      if (byId("laciJudul")) byId("laciJudul").textContent = "Edit laporan gangguan";
      if (byId("btnHapus")) byId("btnHapus").style.display = userRole === "admin" ? "block" : "none";
    } else {
      resetForm();
    }
    renderPositionStrip();
    if (drawer) drawer.classList.add("buka");
    if (overlay) overlay.classList.add("buka");
  }

  function closeDrawer() {
    const drawer = byId("laci");
    const overlay = byId("tirai");
    if (drawer) drawer.classList.remove("buka");
    if (overlay) overlay.classList.remove("buka");
    editingId = null;
  }

  function renderAll() {
    const rows = filterMain();
    setText("sTotal", rows.length);
    setText("sOpen", rows.filter((r) => r[C.status] !== "Selesai").length);
    setText("sMenit", rows.reduce((sum, r) => sum + (Number(r[C.telat]) || 0), 0));
    setText("sSet", new Set(rows.map((r) => r[C.trainset]).filter(Boolean)).size);
    setText("countLabel", `${rows.length} rekaman`);

    const tbody = byId("tbody");
    if (tbody) tbody.innerHTML = rows.slice(0, 50).map((r) => `
      <tr>
        <td>${esc(r[C.tanggal])}<br>${esc(r[C.jam])}</td>
        <td>${esc(r[C.noKa])}</td>
        <td>${esc(r[C.trainset])}</td>
        <td>${esc(r[C.posisi])}</td>
        <td>${esc(r[C.lokasi])}</td>
        <td><b>${esc(String(r[C.kategori]).split(":")[0])}</b><br>${esc(r[C.uraian])}</td>
        <td>${esc(r[C.dampak])}</td>
        <td>${esc(r[C.telat])}'</td>
        <td>${esc(r[C.dipo])}</td>
        <td>${esc(r[C.status])}</td>
      </tr>`).join("");

    renderDatabase();
  }

  function filterMain() {
    const q = (byId("fCari")?.value || "").toLowerCase();
    const st = byId("fStatus")?.value || "";
    const cat = byId("fKategori")?.value || "";
    const dipo = byId("fDipo")?.value || "";
    return DATA.filter((r) => {
      const category = String(r[C.kategori] || "").split(":")[0];
      return (!st || r[C.status] === st) && (!cat || category === cat) && (!dipo || r[C.dipo] === dipo) && (!q || Object.values(r).join(" ").toLowerCase().includes(q));
    });
  }

  function renderDatabase() {
    const tbody = byId("dbTbody");
    if (!tbody) return;
    const q = (byId("dbCari")?.value || "").toLowerCase();
    const st = byId("dbFilterStatus")?.value || "";
    const dipo = byId("dbFilterDipo")?.value || "";
    const cat = byId("dbFilterKategori")?.value || "";
    const rows = DATA.filter((r) => {
      const category = String(r[C.kategori] || "").split(":")[0];
      return (!st || r[C.status] === st) && (!dipo || r[C.dipo] === dipo) && (!cat || category === cat) && (!q || Object.values(r).join(" ").toLowerCase().includes(q));
    });

    setText("dbStatTotal", rows.length);
    setText("dbStatOpen", rows.filter((r) => r[C.status] !== "Selesai").length);
    setText("dbStatSelesai", rows.filter((r) => r[C.status] === "Selesai").length);
    setText("dbStatMenit", rows.reduce((sum, r) => sum + (Number(r[C.telat]) || 0), 0));
    setText("dbCountLabel", `${rows.length} rekaman`);

    tbody.innerHTML = rows.map((r, i) => `
      <tr ${userRole === "admin" ? `data-index="${i}" class="clickable"` : ""}>
        <td>${i + 1}</td><td>${esc(r[C.tanggal])}</td><td>${esc(r[C.jam])}</td><td>${esc(r[C.noKa])}</td>
        <td>${esc(r[C.trainset])}</td><td>${esc(r[C.sf])}</td><td>${esc(r[C.posisi])}</td><td>${esc(r[C.lokasi])}</td>
        <td>${esc(String(r[C.kategori]).split(":")[0])}</td><td>${esc(r[C.uraian])}</td><td>${esc(r[C.dampak])}</td>
        <td>${esc(r[C.telat])}'</td><td>${esc(r[C.dipo])}</td><td>${esc(r[C.status])}</td><td>${esc(r[C.pelapor])}</td>
      </tr>`).join("");

    if (userRole === "admin") {
      tbody.querySelectorAll("tr[data-index]").forEach((tr) => tr.addEventListener("click", () => openDrawer(rows[Number(tr.dataset.index)])));
    }
  }

  function bind() {
    const adminRadio = byId("roleAdmin");
    const userRadio = byId("roleUser");
    if (adminRadio) adminRadio.addEventListener("change", () => { setText("label1", "Username"); if (byId("passwordField")) byId("passwordField").style.display = "block"; });
    if (userRadio) userRadio.addEventListener("change", () => { setText("label1", "Nama Pengguna"); if (byId("passwordField")) byId("passwordField").style.display = "none"; });
    const loginBtn = byId("loginBtn"); if (loginBtn) loginBtn.addEventListener("click", login);
    const logoutBtn = byId("logoutBtn"); if (logoutBtn) logoutBtn.addEventListener("click", logout);
    const btnBaru = byId("btnBaru"); if (btnBaru) btnBaru.addEventListener("click", () => openDrawer(null));
    const btnBaruDb = byId("btnBaruDb"); if (btnBaruDb) btnBaruDb.addEventListener("click", () => openDrawer(null));
    const btnTutup = byId("btnTutup"); if (btnTutup) btnTutup.addEventListener("click", closeDrawer);
    const btnBatal = byId("btnBatal"); if (btnBatal) btnBatal.addEventListener("click", closeDrawer);
    const tirai = byId("tirai"); if (tirai) tirai.addEventListener("click", closeDrawer);
    const btnSimpan = byId("btnSimpan"); if (btnSimpan) btnSimpan.addEventListener("click", saveReport);
    const btnHapus = byId("btnHapus"); if (btnHapus) btnHapus.addEventListener("click", () => { const row = DATA.find((r) => r[C.id] === editingId); if (row) deleteReport(row); });
    const btnMuat = byId("btnMuat"); if (btnMuat) btnMuat.addEventListener("click", loadData);
    const sf = byId("iSf"); if (sf) sf.addEventListener("change", renderPositionStrip);

    ["fCari", "fBulan", "fKategori", "fDipo", "fStatus", "dbCari", "dbFilterStatus", "dbFilterDipo", "dbFilterKategori"].forEach((id) => {
      const el = byId(id);
      if (el) { el.addEventListener("input", renderAll); el.addEventListener("change", renderAll); }
    });

    document.querySelectorAll(".sidebar-nav .nav-item").forEach((item) => item.addEventListener("click", () => {
      document.querySelectorAll(".sidebar-nav .nav-item").forEach((x) => x.classList.remove("aktif"));
      item.classList.add("aktif");
      document.querySelectorAll(".view").forEach((x) => x.classList.remove("aktif"));
      const view = byId(`view${item.dataset.view.charAt(0).toUpperCase()}${item.dataset.view.slice(1)}`);
      if (view) view.classList.add("aktif");
      if (item.dataset.view === "database") renderDatabase();
    }));

    const menuToggle = byId("menuToggle");
    const sidebar = byId("sidebar");
    const overlay = byId("sidebarOverlay");
    if (menuToggle) menuToggle.addEventListener("click", () => { sidebar?.classList.toggle("buka"); overlay?.classList.toggle("buka"); });
    if (overlay) overlay.addEventListener("click", () => { sidebar?.classList.remove("buka"); overlay.classList.remove("buka"); });
  }

  window.addEventListener("DOMContentLoaded", () => {
    bind();
    populateOptions();
    if (loadSession()) showDashboard(); else showLogin();
  });
})();
