const proyekKosong = () => ({
  format: "TTC-Project",
  versi: 1,
  namaProyek: "Proyek TTC",
  stasiun: [],
  petakJalan: []
});

let proyek = proyekKosong();

const el = (id) => document.getElementById(id);

function setStatus(pesan, error = false) {
  const status = el("status");
  status.textContent = pesan;
  status.classList.toggle("error", error);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderStasiun() {
  const list = el("daftar-stasiun");
  if (!proyek.stasiun.length) {
    list.innerHTML = '<div class="empty">Belum ada data stasiun.</div>';
  } else {
    list.innerHTML = proyek.stasiun.map((s) => `
      <div class="item">
        <span class="code">${escapeHtml(s.kode)}</span>
        <span>${escapeHtml(s.nama)}</span>
        <span>km ${Number(s.km).toLocaleString("id-ID")}</span>
        <span>${escapeHtml(s.jumlahJalur)} jalur</span>
        <span>${escapeHtml(s.jenis)}</span>
      </div>
    `).join("");
  }

  const pilihan = proyek.stasiun.map((s) =>
    `<option value="${escapeHtml(s.kode)}">${escapeHtml(s.kode)} — ${escapeHtml(s.nama)}</option>`
  ).join("");
  el("petak-dari").innerHTML = '<option value="">Pilih stasiun</option>' + pilihan;
  el("petak-ke").innerHTML = '<option value="">Pilih stasiun</option>' + pilihan;
  el("jumlah-stasiun").textContent = `${proyek.stasiun.length} stasiun`;
}

function renderPetak() {
  const list = el("daftar-petak");
  if (!proyek.petakJalan.length) {
    list.innerHTML = '<div class="empty">Belum ada data Petak Jalan.</div>';
  } else {
    list.innerHTML = proyek.petakJalan.map((p) => `
      <div class="item petak">
        <span class="code">${escapeHtml(p.dari)}</span>
        <span>→</span>
        <span class="code">${escapeHtml(p.ke)}</span>
        <span>${Number(p.jarak).toLocaleString("id-ID")} km</span>
        <span>${escapeHtml(p.jenisJalur)}</span>
        <span>Vmax ${escapeHtml(p.kecepatanMaks)} km/jam</span>
      </div>
    `).join("");
  }
  el("jumlah-petak").textContent = `${proyek.petakJalan.length} petak`;
}

function renderSemua() {
  renderStasiun();
  renderPetak();
  el("nama-proyek").value = proyek.namaProyek || "Proyek TTC";
}

el("form-stasiun").addEventListener("submit", (event) => {
  event.preventDefault();
  const kode = el("st-kode").value.trim().toUpperCase();
  const nama = el("st-nama").value.trim();
  const km = Number(el("st-km").value);
  const jumlahJalur = Number(el("st-jalur").value);
  const jenis = el("st-jenis").value;

  if (!kode || !nama || !Number.isFinite(km) || !Number.isInteger(jumlahJalur) || jumlahJalur < 1) {
    setStatus("Lengkapi data stasiun dengan benar.", true);
    return;
  }

  proyek.stasiun.push({ kode, nama, km, jumlahJalur, jenis });
  event.target.reset();
  el("st-jalur").value = 2;
  renderStasiun();
  setStatus(`Stasiun ${kode} — ${nama} ditambahkan.`);
});

el("form-petak").addEventListener("submit", (event) => {
  event.preventDefault();
  const dari = el("petak-dari").value;
  const ke = el("petak-ke").value;
  const jarak = Number(el("petak-jarak").value);
  const jenisJalur = el("petak-jenis").value;
  const kecepatanMaks = Number(el("petak-vmax").value);

  if (!dari || !ke || dari === ke || !Number.isFinite(jarak) || jarak <= 0 || !Number.isFinite(kecepatanMaks) || kecepatanMaks <= 0) {
    setStatus("Lengkapi data Petak Jalan dengan benar dan pilih dua stasiun yang berbeda.", true);
    return;
  }

  proyek.petakJalan.push({ dari, ke, jarak, jenisJalur, kecepatanMaks });
  event.target.reset();
  renderPetak();
  setStatus(`Petak Jalan ${dari}–${ke} ditambahkan.`);
});

el("nama-proyek").addEventListener("input", (event) => {
  proyek.namaProyek = event.target.value;
});

el("btn-baru").addEventListener("click", () => {
  if (proyek.stasiun.length || proyek.petakJalan.length) {
    const lanjut = confirm("Buat proyek baru? Data yang belum disimpan akan hilang dari layar.");
    if (!lanjut) return;
  }
  proyek = proyekKosong();
  renderSemua();
  setStatus("Proyek baru siap.");
});

el("btn-simpan").addEventListener("click", () => {
  proyek.namaProyek = el("nama-proyek").value.trim() || "Proyek TTC";
  const json = JSON.stringify(proyek, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const namaFile = proyek.namaProyek
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "proyek-ttc";
  a.href = url;
  a.download = `${namaFile}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus(`Proyek disimpan sebagai ${namaFile}.json.`);
});

el("file-buka").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.format !== "TTC-Project" || !Array.isArray(data.stasiun) || !Array.isArray(data.petakJalan)) {
      throw new Error("Format proyek TTC tidak dikenali.");
    }
    proyek = {
      format: "TTC-Project",
      versi: Number(data.versi) || 1,
      namaProyek: String(data.namaProyek || "Proyek TTC"),
      stasiun: data.stasiun,
      petakJalan: data.petakJalan
    };
    renderSemua();
    setStatus(`Proyek ${file.name} berhasil dibuka: ${proyek.stasiun.length} stasiun, ${proyek.petakJalan.length} petak.`);
  } catch (error) {
    setStatus(`Gagal membuka proyek: ${error.message}`, true);
  } finally {
    event.target.value = "";
  }
});

el("btn-contoh").addEventListener("click", () => {
  proyek = {
    format: "TTC-Project",
    versi: 1,
    namaProyek: "Contoh Bogor–Manggarai",
    stasiun: [
      { kode: "BOO", nama: "Bogor", km: 0, jumlahJalur: 4, jenis: "Stasiun" },
      { kode: "BJD", nama: "Bojong Gede", km: 9.2, jumlahJalur: 2, jenis: "Stasiun" },
      { kode: "CTA", nama: "Citayam", km: 13.7, jumlahJalur: 3, jenis: "Stasiun" },
      { kode: "DP", nama: "Depok", km: 20.2, jumlahJalur: 4, jenis: "Stasiun" },
      { kode: "MRI", nama: "Manggarai", km: 44.6, jumlahJalur: 8, jenis: "Stasiun" }
    ],
    petakJalan: [
      { dari: "BOO", ke: "BJD", jarak: 9.2, jenisJalur: "Ganda", kecepatanMaks: 70 },
      { dari: "BJD", ke: "CTA", jarak: 4.5, jenisJalur: "Ganda", kecepatanMaks: 70 },
      { dari: "CTA", ke: "DP", jarak: 6.5, jenisJalur: "Ganda", kecepatanMaks: 70 },
      { dari: "DP", ke: "MRI", jarak: 24.4, jenisJalur: "Ganda", kecepatanMaks: 70 }
    ]
  };
  renderSemua();
  setStatus("5 stasiun contoh dimuat untuk pengujian Tahap 1. Angka contoh bukan data operasional resmi.");
});

renderSemua();
setStatus("Tahap 1 aktif. Isi data jaringan, lalu uji Simpan dan Buka proyek JSON.");
