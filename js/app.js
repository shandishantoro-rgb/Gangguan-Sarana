(() => {
  "use strict";

  const API_URL = "https://script.google.com/macros/s/AKfycbzAPIS8uo5J3YOTDfuMZD4mJtmK52w34YP9zeDSGsUEIQjSgGwTRfrcDlN4KxdpJOMqVQ/exec";
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
  let submitting = false;
  let jsonpSeq = 0;
  let chart = null;

  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>\"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
  const setText = (id, value) => { const e = byId(id); if (e) e.textContent = value; };

  function toast(message) {
    const e = byId("pesan");
    if (!e) return;
    e.textContent = message;
    e.classList.add("tampil");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => e.classList.remove("tampil"), 3000);
  }

  async function sha256(text) {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function saveSession() { sessionStorage.setItem("gssession", JSON.stringify({user: currentUser, role: userRole})); }
  function clearSession() { sessionStorage.removeItem("gssession"); }
  function loadSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem("gssession") || "null");
      if (s?.user && s?.role) { currentUser = s.user; userRole = s.role; return true; }
    } catch (_) {}
    return false;
  }

  function showLogin() {
    byId("loginScreen")?.classList.remove("hidden");
    byId("dashboardScreen")?.classList.remove("visible");
  }

  function setRoleUI() {
    setText("userRole", `${userRole === "admin" ? "Admin: " : "User: "}${currentUser}`);
    setText("sidebarUserName", currentUser);
    setText("sidebarUserRole", userRole === "admin" ? "Admin" : "User");
    if (byId("btnBaru")) byId("btnBaru").style.display = "block";
    if (byId("btnBaruDb")) byId("btnBaruDb").style.display = "block";
    if (byId("btnSimpan")) byId("btnSimpan").style.display = "block";
    if (byId("btnDbCsv")) byId("btnDbCsv").style.display = userRole === "admin" ? "inline-flex" : "none";
  }

  async function showDashboard() {
    byId("loginScreen")?.classList.add("hidden");
    byId("dashboardScreen")?.classList.add("visible");
    setRoleUI();
    populateOptions();
    updateClock();
    if (!showDashboard.timer) showDashboard.timer = setInterval(updateClock, 1000);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await loadData();
    requestAnimationFrame(() => renderAll());
  }

  async function login() {
    const role = document.querySelector('input[name="role"]:checked')?.value || "user";
    const name = (byId("username")?.value || "").trim();
    const pass = byId("password")?.value || "";
    const err = byId("loginError");
    if (err) { err.textContent = ""; err.style.display = "none"; }
    if (!name) {
      if (err) { err.textContent = role === "admin" ? "Silakan isi username" : "Silakan isi nama pengguna"; err.style.display = "block"; }
      return;
    }
    if (role === "admin" && (name !== ADMIN_USER || await sha256(pass) !== ADMIN_PASSWORD_SHA256)) {
      if (err) { err.textContent = "Username atau password salah"; err.style.display = "block"; }
      return;
    }
    currentUser = name;
    userRole = role;
    saveSession();
    await showDashboard();
  }

  function logout() {
    currentUser = ""; userRole = ""; DATA = []; editingId = null; clearSession();
    if (byId("username")) byId("username").value = "";
    if (byId("password")) byId("password").value = "";
    if (byId("roleAdmin")) byId("roleAdmin").checked = true;
    if (byId("passwordField")) byId("passwordField").style.display = "block";
    showLogin();
  }

  function updateClock() {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    const hari = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
    const bulan = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    setText("jamNow", `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
    setText("tglNow", `${hari[d.getDay()]}, ${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`);
  }

  function jsonp(params) {
    return new Promise((resolve, reject) => {
      const cb = `__gss_cb_${Date.now()}_${++jsonpSeq}`;
      const script = document.createElement("script");
      const query = new URLSearchParams({...params, callback: cb, _: Date.now()}).toString();
      let done = false;
      const cleanup = () => { try { delete window[cb]; } catch (_) {} script.remove(); };
      const timer = setTimeout(() => { if (done) return; done = true; cleanup(); reject(new Error("API timeout")); }, 15000);
      window[cb] = data => { if (done) return; done = true; clearTimeout(timer); cleanup(); resolve(data); };
      script.onerror = () => { if (done) return; done = true; clearTimeout(timer); cleanup(); reject(new Error("Gagal menghubungi Google Sheets API")); };
      script.src = `${API_URL}?${query}`;
      document.head.appendChild(script);
    });
  }

  function parseMeta(value) {
    const raw = String(value ?? "").trim();
    const match = raw.match(/^META(\{[\s\S]*\})$/) || raw.match(/^__META__(\{[\s\S]*\})$/);
    if (!match) return {};
    try { return JSON.parse(match[1]); } catch (_) { return {}; }
  }

  function findMeta(row) {
    const fields = [row.keterangan, row.Keterangan, row.dampak, row.Dampak, row.tindakan, row.Tindakan];
    for (const value of fields) {
      const meta = parseMeta(value);
      if (Object.keys(meta).length) return meta;
    }
    return {};
  }

  function formatDate(value) {
    const s = String(value ?? "").trim();
    if (!s) return "";
    const d = new Date(s);
    if (/^\d{4}-\d{2}-\d{2}T/.test(s) && !Number.isNaN(d.getTime())) {
      return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y,m,day] = s.split("-");
      return `${day}/${m}/${y}`;
    }
    return s;
  }

  function formatTime(value) {
    const s = String(value ?? "").trim();
    if (!s) return "";
    if (/^1899-12-30T/i.test(s)) {
      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) return `${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`;
    }
    const m = s.match(/^(\d{1,2}):(\d{2})/);
    return m ? `${String(m[1]).padStart(2,"0")}:${m[2]}` : s;
  }

  function mapRow(row) {
    const meta = findMeta(row);
    const dampakRaw = String(row.dampak ?? row.Dampak ?? "");
    const dampak = /^META(\{|__META__)/.test(dampakRaw) ? (meta.dampak || "") : dampakRaw;
    const n = Number(row.rowIndex || 0);
    return {
      [C.id]: `gs-${n}`,
      [C.tanggal]: formatDate(row.Tanggal ?? row.tanggal),
      [C.jam]: formatTime(row.Jam ?? row.jam),
      [C.noKa]: row["No KA"] ?? row.no_ka ?? "",
      [C.relasi]: row.Relasi ?? row.relasi ?? "",
      [C.trainset]: row.Trainset ?? row.trainset ?? "",
      [C.sf]: row.SF ?? row.sf ?? "",
      [C.posisi]: row["Posisi Kereta"] ?? row.posisi_kereta ?? "",
      [C.lokasi]: row.Lokasi ?? row.lokasi ?? "",
      [C.kategori]: row["Kategori Gangguan"] ?? row.kategori_gangguan ?? "",
      [C.uraian]: row["Uraian Gangguan"] ?? row.uraian_gangguan ?? "",
      [C.tindakan]: meta.tindakan || "",
      [C.dampak]: dampak,
      [C.telat]: meta.telat ?? row.Keterlambatan ?? row.keterlambatan ?? 0,
      [C.dipo]: meta.dipo || row.Dipo || row.dipo || "",
      [C.pelapor]: meta.pelapor || row.Pelapor || row.pelapor || "",
      [C.status]: meta.status || row.Status || row.status || "Terbuka",
      [C.dibuat]: meta.dibuat || "",
      _rowIndex: n,
      _requestId: meta.request_id || ""
    };
  }

  async function loadData() {
    try {
      const result = await jsonp({action:"read"});
      if (!result?.success) throw new Error(result?.error || "Gagal membaca Google Sheets");
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

  function packMeta(data, requestId) {
    return `META${JSON.stringify({request_id: requestId || "", tindakan: data[C.tindakan] || "", telat: data[C.telat] || "0", dipo: data[C.dipo] || "", pelapor: data[C.pelapor] || currentUser, status: data[C.status] || "Terbuka", dibuat: data[C.dibuat] || new Date().toISOString()})}`;
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
      [C.telat]: byId("iTelat")?.value || "0",
      [C.dipo]: byId("iDipo")?.value || "",
      [C.pelapor]: byId("iPelapor")?.value.trim() || currentUser,
      [C.status]: byId("iStatus")?.value || "Terbuka",
      [C.dibuat]: new Date().toISOString()
    };
  }

  async function saveReport() {
    if (submitting) return;
    const data = readForm();
    if (!data[C.tanggal] || !data[C.noKa] || !data[C.trainset] || !data[C.kategori]) { toast("Lengkapi tanggal, No KA, trainset, dan kategori."); return; }
    if (editingId && userRole !== "admin") { toast("User hanya dapat membuat laporan baru."); return; }
    const button = byId("btnSimpan");
    const oldText = button?.textContent || "Simpan laporan";
    submitting = true;
    if (button) { button.disabled = true; button.textContent = "Menyimpan..."; }
    try {
      let result;
      const requestId = editingId ? "" : crypto.randomUUID();
      if (editingId) {
        const row = DATA.find(r => r[C.id] === editingId);
        if (!row) throw new Error("Data tidak ditemukan");
        result = await jsonp({action:"update", rowIndex:row._rowIndex, kategori_gangguan:data[C.kategori], uraian_gangguan:data[C.uraian], dampak:data[C.dampak], keterangan:packMeta(data,row._requestId)});
      } else {
        result = await jsonp({action:"create", tanggal:data[C.tanggal], jam:data[C.jam], no_ka:data[C.noKa], relasi:data[C.relasi], trainset:data[C.trainset], sf:data[C.sf], posisi_kereta:data[C.posisi], lokasi:data[C.lokasi], kategori_gangguan:data[C.kategori], uraian_gangguan:data[C.uraian], dampak:data[C.dampak], keterangan:packMeta(data,requestId), request_id:requestId});
      }
      if (!result?.success) throw new Error(result?.error || "Google Sheets menolak penyimpanan");
      closeDrawer();
      toast(result.isDuplicate ? "Laporan sudah tersimpan" : "Data berhasil disimpan");
      await loadData();
    } catch (e) { console.error(e); toast(e.message); }
    finally { submitting = false; if (button) { button.disabled = false; button.textContent = oldText; } }
  }

  async function deleteReport(row) {
    if (userRole !== "admin" || !row) return;
    if (!confirm(`Hapus laporan ${row[C.noKa] || ""} / ${row[C.trainset] || ""}?`)) return;
    try {
      const result = await jsonp({action:"delete", rowIndex:row._rowIndex});
      if (!result?.success) throw new Error(result?.error || "Gagal menghapus data");
      toast("Data berhasil dihapus");
      await loadData();
    } catch (e) { toast(e.message); }
  }

  function populateSelect(id, items, first) {
    const s = byId(id); if (!s) return;
    s.innerHTML = `<option value="">${esc(first)}</option>` + items.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
  }
  function populateOptions() {
    populateSelect("iKategori", KATEGORI, "Pilih kategori");
    populateSelect("iDipo", DIPO, "Pilih dipo");
    populateSelect("iDampak", DAMPAK, "Pilih dampak");
    ensureOtherCategory();
    renderPositionStrip();
  }
  function ensureOtherCategory() {
    const s = byId("iKategori"); if (!s || byId("iKategoriLain")) return;
    const i = document.createElement("input"); i.id="iKategoriLain"; i.type="text"; i.maxLength=60; i.placeholder="Tulis singkat, mis. lampu kabin";
    i.style.cssText="display:none;margin-top:6px;width:100%;padding:8px 10px;border:1px solid #C9CFD9;border-radius:7px";
    s.parentElement.appendChild(i);
    s.addEventListener("change",()=>{i.style.display=s.value==="Lain-lain"?"block":"none";if(s.value!=="Lain-lain")i.value="";});
  }
  function renderPositionStrip() {
    const sf=byId("iSf"), strip=byId("stripForm"); if(!sf||!strip)return;
    const n=Number(sf.value||8); if(selectedPosition>n)selectedPosition=null;
    let h=`<span class="arah">◀ 1</span>`; for(let i=1;i<=n;i++)h+=`<span class="k${selectedPosition===i?" aktif":""}" data-pos="${i}" role="button" tabindex="0">${i}</span>`; h+=`<span class="arah">${n} ▶</span>`; strip.innerHTML=h;
    strip.querySelectorAll(".k").forEach(k=>{const choose=()=>{selectedPosition=Number(k.dataset.pos);renderPositionStrip();};k.addEventListener("click",choose);k.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();choose();}});});
  }
  function resetForm() {
    editingId=null; selectedPosition=null; const d=new Date(); const pad=n=>String(n).padStart(2,"0");
    if(byId("iTanggal"))byId("iTanggal").value=d.toISOString().slice(0,10); if(byId("iJam"))byId("iJam").value=`${pad(d.getHours())}:${pad(d.getMinutes())}`;
    ["iNoKa","iRelasi","iTrainset","iLokasi","iUraian","iTindakan"].forEach(id=>{if(byId(id))byId(id).value="";});
    if(byId("iSf"))byId("iSf").value="8"; if(byId("iTelat"))byId("iTelat").value="0"; if(byId("iStatus"))byId("iStatus").value="Terbuka"; if(byId("iPelapor"))byId("iPelapor").value=currentUser; if(byId("iKategori"))byId("iKategori").value="";
    if(byId("iKategoriLain")){byId("iKategoriLain").value="";byId("iKategoriLain").style.display="none";} populateOptions(); setText("laciJudul","Laporan gangguan baru"); if(byId("btnHapus"))byId("btnHapus").style.display="none";
  }
  function openDrawer(row=null) {
    editingId=row?row[C.id]:null; populateOptions(); const drawer=byId("laci"), overlay=byId("tirai");
    if(row){const set=(id,v)=>{if(byId(id))byId(id).value=v??""}; set("iTanggal",row[C.tanggal]);set("iJam",row[C.jam]);set("iNoKa",row[C.noKa]);set("iRelasi",row[C.relasi]);set("iTrainset",row[C.trainset]);set("iSf",row[C.sf]||8);set("iLokasi",row[C.lokasi]);set("iDampak",row[C.dampak]);set("iTelat",row[C.telat]||0);set("iDipo",row[C.dipo]);set("iStatus",row[C.status]||"Terbuka");set("iPelapor",row[C.pelapor]||currentUser);set("iUraian",row[C.uraian]);set("iTindakan",row[C.tindakan]); const cat=String(row[C.kategori]||""); if(cat.startsWith("Lain-lain:")){byId("iKategori").value="Lain-lain";byId("iKategoriLain").style.display="block";byId("iKategoriLain").value=cat.slice(10).trim();}else byId("iKategori").value=cat; selectedPosition=Number(row[C.posisi])||null;setText("laciJudul","Edit laporan gangguan"); if(byId("btnHapus"))byId("btnHapus").style.display=userRole==="admin"?"block":"none";} else resetForm();
    renderPositionStrip(); drawer?.classList.add("buka"); overlay?.classList.add("buka");
  }
  function closeDrawer(){byId("laci")?.classList.remove("buka");byId("tirai")?.classList.remove("buka");editingId=null;}

  function filterMain(){const q=(byId("fCari")?.value||"").toLowerCase(),st=byId("fStatus")?.value||"",cat=byId("fKategori")?.value||"",d=byId("fDipo")?.value||"";return DATA.filter(r=>{const c=String(r[C.kategori]||"").split(":")[0];return(!st||r[C.status]===st)&&(!cat||c===cat)&&(!d||r[C.dipo]===d)&&(!q||Object.values(r).join(" ").toLowerCase().includes(q));});}
  function renderDatabase(){const tb=byId("dbTbody");if(!tb)return;const q=(byId("dbCari")?.value||"").toLowerCase(),st=byId("dbFilterStatus")?.value||"",d=byId("dbFilterDipo")?.value||"",cat=byId("dbFilterKategori")?.value||"";const rows=DATA.filter(r=>{const c=String(r[C.kategori]||"").split(":")[0];return(!st||r[C.status]===st)&&(!d||r[C.dipo]===d)&&(!cat||c===cat)&&(!q||Object.values(r).join(" ").toLowerCase().includes(q));});setText("dbStatTotal",rows.length);setText("dbStatOpen",rows.filter(r=>r[C.status]!=="Selesai").length);setText("dbStatSelesai",rows.filter(r=>r[C.status]==="Selesai").length);setText("dbStatMenit",rows.reduce((a,r)=>a+(Number(r[C.telat])||0),0));setText("dbCountLabel",`${rows.length} rekaman`);tb.innerHTML=rows.map((r,i)=>`<tr ${userRole==="admin"?`data-index="${i}" class="clickable"`:""}><td>${i+1}</td><td>${esc(r[C.tanggal])}</td><td>${esc(r[C.jam])}</td><td>${esc(r[C.noKa])}</td><td>${esc(r[C.trainset])}</td><td>${esc(r[C.sf])}</td><td>${esc(r[C.posisi])}</td><td>${esc(r[C.lokasi])}</td><td>${esc(String(r[C.kategori]).split(":")[0])}</td><td>${esc(r[C.uraian])}</td><td>${esc(r[C.dampak])}</td><td>${esc(r[C.telat])}'</td><td>${esc(r[C.dipo])}</td><td>${esc(r[C.status])}</td><td>${esc(r[C.pelapor])}</td></tr>`).join("");if(userRole==="admin")tb.querySelectorAll("tr[data-index]").forEach(tr=>tr.addEventListener("click",()=>openDrawer(rows[Number(tr.dataset.index)])));}
  function renderChart(){if(typeof Chart==="undefined")return;const canvas=byId("grafikCanvas");if(!canvas)return;const labels=DATA.map(r=>r[C.tanggal]);const values=DATA.map(()=>1);if(chart)chart.destroy();chart=new Chart(canvas.getContext("2d"),{type:"line",data:{labels,datasets:[{label:"Gangguan",data:values,borderWidth:2,tension:.25}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}}});setText("grafikTotal",DATA.length);setText("grafikRata",DATA.length?1:0);setText("grafikPeriode",DATA.length?`${DATA[0][C.tanggal]} - ${DATA[DATA.length-1][C.tanggal]}`:"-");}
  function renderAll(){const rows=filterMain();setText("sTotal",rows.length);setText("sOpen",rows.filter(r=>r[C.status]!=="Selesai").length);setText("sMenit",rows.reduce((a,r)=>a+(Number(r[C.telat])||0),0));setText("sSet",new Set(rows.map(r=>r[C.trainset]).filter(Boolean)).size);setText("countLabel",`${rows.length} rekaman`);const tb=byId("tbody");if(tb)tb.innerHTML=rows.slice(0,50).map(r=>`<tr><td>${esc(r[C.tanggal])}<br>${esc(r[C.jam])}</td><td>${esc(r[C.noKa])}</td><td>${esc(r[C.trainset])}</td><td>${esc(r[C.posisi])}</td><td>${esc(r[C.lokasi])}</td><td><b>${esc(String(r[C.kategori]).split(":")[0])}</b><br>${esc(r[C.uraian])}</td><td>${esc(r[C.dampak])}</td><td>${esc(r[C.telat])}'</td><td>${esc(r[C.dipo])}</td><td>${esc(r[C.status])}</td></tr>`).join("");renderDatabase();renderChart();}

  function bind(){
    byId("roleAdmin")?.addEventListener("change",()=>{setText("label1","Username");if(byId("passwordField"))byId("passwordField").style.display="block";});
    byId("roleUser")?.addEventListener("change",()=>{setText("label1","Nama Pengguna");if(byId("passwordField"))byId("passwordField").style.display="none";});
    byId("loginBtn")?.addEventListener("click",login); byId("logoutBtn")?.addEventListener("click",logout);
    byId("btnBaru")?.addEventListener("click",()=>openDrawer()); byId("btnBaruDb")?.addEventListener("click",()=>openDrawer());
    byId("btnTutup")?.addEventListener("click",closeDrawer); byId("btnBatal")?.addEventListener("click",closeDrawer); byId("tirai")?.addEventListener("click",closeDrawer);
    byId("btnSimpan")?.addEventListener("click",saveReport); byId("btnHapus")?.addEventListener("click",()=>{const r=DATA.find(x=>x[C.id]===editingId);if(r)deleteReport(r);}); byId("btnMuat")?.addEventListener("click",loadData); byId("iSf")?.addEventListener("change",renderPositionStrip);
    ["fCari","fBulan","fKategori","fDipo","fStatus","dbCari","dbFilterStatus","dbFilterDipo","dbFilterKategori"].forEach(id=>{const e=byId(id);if(e){e.addEventListener("input",renderAll);e.addEventListener("change",renderAll);}});
    document.querySelectorAll(".sidebar-nav .nav-item").forEach(item=>item.addEventListener("click",()=>{document.querySelectorAll(".sidebar-nav .nav-item").forEach(x=>x.classList.remove("aktif"));item.classList.add("aktif");document.querySelectorAll(".view").forEach(x=>x.classList.remove("aktif"));byId(`view${item.dataset.view.charAt(0).toUpperCase()}${item.dataset.view.slice(1)}`)?.classList.add("aktif");if(item.dataset.view==="database")renderDatabase();}));
    const mt=byId("menuToggle"),sb=byId("sidebar"),ov=byId("sidebarOverlay"); mt?.addEventListener("click",()=>{sb?.classList.toggle("buka");ov?.classList.toggle("buka")}); ov?.addEventListener("click",()=>{sb?.classList.remove("buka");ov?.classList.remove("buka")});
  }

  window.addEventListener("DOMContentLoaded",()=>{bind();populateOptions();if(loadSession())showDashboard();else showLogin();});
})();