# TTC — Train Traffic Simulator

Aplikasi perencanaan operasi kereta api: menyusun data prasarana dan sarana,
membangkitkan jadwal perjalanan secara otomatis dari fisika gerak kereta,
menggambar GAPEKA, memeriksa konflik, dan mensimulasikan perjalanan.

Dibuat untuk perencanaan lintas commuter, berjalan sepenuhnya di browser —
tanpa pemasangan, tanpa server, tanpa data yang keluar dari komputer Anda.

## Menjalankan

Klik dua kali `index.html`. Selesai.
Tidak perlu Python, Node, atau server web.

Untuk menjadikannya dapat dibuka lewat tautan: aktifkan **GitHub Pages**
pada repo ini (Settings → Pages → Branch: `main`, folder `/root`).

## Alur kerja

| Langkah | Menu | Yang dikerjakan |
|---|---|---|
| 1 | Stasiun | Kode, nama, km, jumlah jalur. Km menentukan urutan lintas. |
| 2 | Petak Jalan | Jarak, jenis jalur, kecepatan maksimum, gradien, radius lengkung. Tombol **Buat dari urutan Km** mengisi seluruh petak sekaligus. |
| 2a | Emplasemen | Jalur, wesel, dan rute tiap stasiun. Rute disusun otomatis dari tata letak; dua rute yang berbagi elemen tidak boleh terkunci bersamaan. |
| 2b | Sinyal | Nomor sinyal, letak km, jenis, arah, jumlah aspek. **Petak blok disimpulkan dari letak sinyal**, bukan diinput sendiri. |
| 2c | Blok & Kapasitas | Headway minimum dan kapasitas tiap petak, dihitung dari blocking time blok hasil derivasi sinyal. |
| 3 | Sarana | Massa, daya, percepatan, perlambatan, koefisien tahanan Davis. |
| 4 | Pola Operasi | Relasi, jam operasi, headway, pola berhenti, penomoran KA. |
| 5 | Buat Jadwal | Menghasilkan seluruh perjalanan beserta jam datang/berangkat tiap stasiun. |
| 6 | GAPEKA | Grafik perjalanan; zoom, geser, klik garis untuk menyorot. |
| 7 | Periksa Konflik | Persilangan, penyusulan, headway, okupansi jalur. |
| 8 | Simulasi | Jam berjalan dan posisi tiap KA di lintas. |
| 9 | Ekspor | Daftar Waktu (CSV), matriks jadwal (CSV), GAPEKA (SVG/PNG), berkas proyek (JSON). |

Tombol **Contoh** memuat lintas Bogor–Jakarta Kota (24 stasiun) untuk mencoba
seluruh alur tanpa mengetik data apa pun.

## Mesin waktu tempuh

Waktu tempuh tidak dihitung dari jarak dibagi kecepatan rata-rata, melainkan
dari integrasi gerak kereta. Seluruh rumus di bawah ini adalah rumus terbuka
dalam literatur teknik perkeretaapian.

**1. Tahanan jalan — persamaan Davis**

```
R = m · (A + B·v + C·v²)        [N]     m dalam ton, v dalam km/jam
```

**2. Tahanan tanjakan**

```
Rg = m · g · (i / 1000)         [N]     i dalam per mil (‰)
```

**3. Tahanan lengkung — rumus Röckl**

```
Rc = m · 6,5 · g / (R − 55)     [N]     R jari-jari lengkung, meter
```

**4. Gaya tarik**

```
F = min( m · a₀ , P / v )
```

Gaya tetap pada kecepatan rendah, daya tetap pada kecepatan tinggi.

**5. Percepatan efektif**

```
a = (F − ΣR) / (m · (1 + λ))    λ ≈ 0,08 untuk massa berputar
```

Profil kecepatan disusun dua sapuan pada kisi jarak 5 meter. Sapuan mundur
menyiapkan selubung pengereman sehingga kereta selalu dapat berhenti tepat
pada batas kecepatan berikutnya; sapuan maju menerapkan gaya tarik yang
tersedia. Kecepatan di tiap titik adalah nilai terkecil dari batas lintas,
selubung pengereman, dan kemampuan tarik.

### Mengalibrasi terhadap GAPEKA yang berlaku

Mesin ini menghasilkan **waktu tempuh murni** — hasil fisika tanpa cadangan.
GAPEKA sebenarnya selalu lebih longgar karena memuat cadangan waktu untuk
gangguan kecil, kepadatan penumpang, dan ketaatan sinyal.

Cara mengalibrasi:

1. Buka **Sarana → Uji cepat waktu tempuh**, hitung satu petak yang Anda hafal.
2. Bandingkan dengan daftar waktu yang berlaku.
3. Naikkan **Parameter → Waktu tambahan (WT %)** sampai selisihnya menutup.

Angka WT itulah cadangan waktu nyata di lintas Anda — dan itu sendiri sudah
merupakan informasi perencanaan yang berguna.

## Emplasemen

Stasiun berhenti menjadi satu titik dan menjadi kumpulan **elemen**:

| Istilah | Arti dalam aplikasi |
|---|---|
| Elemen | Bagian terkecil yang bisa diduduki satu KA — jalur (sepur) atau kaki wesel |
| Jalur | Nomor, nama, panjang efektif, berperon atau tidak, arah lazim |
| Wesel | Nomor, sisi (barat/timur), tipe (1:8 … 1:18), kecepatan belok |
| Rute | Urutan elemen dari sinyal masuk sampai jalur tujuan, atau dari jalur menuju sinyal keluar |

**Aturan pokoknya satu:** dua rute tidak boleh terkunci bersamaan bila berbagi
satu elemen pun. Itulah yang diperiksa, dan itu jauh lebih tajam daripada
sekadar menghitung "berapa KA di stasiun berjalur berapa".

### Tata letak tangga

Template memakai tata letak tangga:

```
WB1 belok → Jalur berikut,  lurus → WB2
WB2 belok → Jalur berikut,  lurus → WB3
...
```

Sehingga jalur pertama tiap kelompok adalah sepur lurus, dan rute ke jalur
bernomor besar melewati lebih banyak wesel — persis seperti di lapangan.

**Lintas ganda** membuat dua kelompok terpisah: jalur ganjil melayani hilir,
genap melayani hulu, masing-masing dengan tangga weselnya sendiri. Perjalanan
hilir dan hulu karena itu tidak saling mengunci wesel. **Lintas tunggal**
memakai satu kelompok bersama, sehingga perjalanan dua arah memang berebut
wesel yang sama — dan konfliknya muncul.

### Yang ikut terperiksa

| Temuan | Penyebab |
|---|---|
| Rute bentrok di emplasemen | Dua rute berbagi wesel atau jalur pada waktu yang sama |
| Tidak ada jalur tersedia | Semua jalur yang cocok sedang terpakai |
| Rangkaian tidak muat di jalur | Panjang rangkaian melebihi panjang efektif jalur terpanjang |

Kecepatan belok wesel juga masuk ke rute, jadi KA yang masuk jalur belok
memang berjalan lebih lambat.

Stasiun yang **belum** digambar layoutnya tetap dipakai dengan cara lama —
pemeriksaan berbasis jumlah jalur. Jadi Anda bisa mulai dari Manggarai dan
Depok saja, aplikasi tetap berjalan penuh.

## Sinyal

Sinyal adalah data utama, dan petak blok adalah turunannya — bukan sebaliknya.
Tiap sinyal punya:

| Ruas | Isi |
|---|---|
| Nomor | Nomor sinyal sebenarnya, mis. `J12`, `B403` |
| Km | Letak sinyal pada sumbu km lintas |
| Jenis | `masuk` · `keluar` · `blok antara` · `muka` · `langsir` |
| Arah | `hilir` (km bertambah) atau `hulu` (km berkurang) |
| Aspek | 2, 3, atau 4 indikasi |

Hanya sinyal **masuk**, **keluar**, dan **blok antara** yang membatasi blok.
Sinyal muka memberi peringatan, sinyal langsir tidak membatasi blok.

Petak blok = ruas antara dua sinyal utama yang berurutan pada arah yang sama.
Menambah satu sinyal blok antara langsung memecah satu blok menjadi dua, dan
kapasitas petak itu ikut berubah — tanpa Anda mengubah apa pun yang lain.

Tombol **Bangun otomatis** membuat kerangka awal: sinyal masuk dan keluar di
tiap stasiun untuk kedua arah, ditambah sinyal blok antara tiap jarak tertentu.
Nomor yang dihasilkan hanya sementara — ganti dengan nomor sebenarnya dari
skema sinyal lintas Anda.

### Aspek

| Indikasi | Aspek yang mungkin |
|---|---|
| 2 | Hijau, Merah (peringatan lewat sinyal muka) |
| 3 | Hijau, Kuning, Merah |
| 4 | Hijau, Kuning kehijauan, Kuning, Merah |

Aspek dihitung dari okupansi blok: blok di depan terisi → **merah**; blok
berikutnya terisi → **kuning**; blok kedua berikutnya terisi → **kuning
kehijauan** (pada sinyal 4 indikasi); selain itu **hijau**.

## Simulasi Sinyal

Berbeda dari Simulasi Jadwal yang hanya memutar ulang jadwal, di sini kereta
benar-benar dikendalikan. Tiap langkah waktu, kereta membaca aspek sinyal di
depannya dan bertindak:

- **Merah** — mengerem sampai berhenti 10 meter di muka sinyal, dan **tidak
  melewatinya**
- **Kuning** — mengerem agar mampu berhenti di sinyal berikutnya
- **Hijau** — berjalan sampai kecepatan lintas

Geraknya memakai gaya tarik dan tahanan yang sama dengan mesin dinamika, jadi
pengeremannya nyata, bukan pemotongan kecepatan seketika.

Tersedia **penahanan buatan**: tahan satu KA sekian menit, lalu amati
rambatannya ke KA di belakangnya. Inilah cara memeriksa ketahanan jadwal
terhadap gangguan — sesuatu yang tidak bisa dijawab oleh pemeriksaan konflik
statis.

## Blok & kapasitas — blocking time

Headway tidak ditetapkan sendiri, melainkan dihitung dari okupansi blok.
Satu blok tidak hanya terpakai selama kereta berada di dalamnya — blok sudah
terkunci sejak rute dibentuk dan baru lepas setelah seluruh rangkaian
membebaskannya. Enam komponen (teori blocking time, Pachl / Hansen):

```
blocking time satu blok =
    pembentukan rute          rute dikunci sebelum sinyal aman
  + waktu pandang             masinis melihat sinyal muka
  + waktu pendekat            menempuh blok sebelumnya (jarak pengereman)
  + waktu tempuh blok         melintasi blok itu sendiri
  + waktu pembebasan          panjang rangkaian melewati batas blok
  + pelepasan blok            blok dilepas kembali
```

**Headway minimum satu petak = blocking time terbesar di antara bloknya.**
Blok itulah penentu kapasitas petak, dan petak dengan headway terbesar adalah
penentu kapasitas seluruh lintas — ditandai merah pada tabel.

Menu **Sinyal & Blok** menampilkan skema blok tiap petak beserta **tangga
blocking time**-nya: tiap batang adalah satu blok, garis hijau adalah lintasan
kereta menembusnya, dan batang merah adalah blok penentu. Memperpendek blok
memperkecil batang penentu, dan kapasitas langsung terlihat naik.

Setelah blok didefinisikan, pemeriksa konflik berhenti memakai satu angka
headway global dan beralih memakai headway hasil hitungan per petak.

Pengisian blok bisa lewat tombol **Bagi rata** (seluruh petak sekaligus,
misal blok ±700 m) untuk mencoba cepat, lalu diperhalus per petak lewat
**Atur blok** ketika data sinyal yang sebenarnya sudah terkumpul.

## Pemeriksaan konflik

| Jenis | Yang dideteksi |
|---|---|
| Persilangan di lintas tunggal | Dua KA berlawanan arah menempati petak jalur tunggal pada waktu bersamaan |
| Penyusulan di petak | KA searah saling menyusul di dalam petak, bukan di stasiun |
| Headway kurang | Selang antar KA searah di bawah headway minimum — dihitung dari blocking time bila blok sudah didefinisikan |
| Jalur stasiun penuh | Jumlah KA bersamaan di satu stasiun melebihi jumlah jalur tersedia |
| Rute bentrok di emplasemen | Dua rute berbagi wesel atau jalur — hanya untuk stasiun yang sudah digambar layoutnya |
| Rangkaian tidak muat di jalur | Panjang rangkaian melebihi panjang efektif jalur |

## Berkas

```
index.html              tampilan
styles.css              gaya
js/ttc-model.js         struktur data proyek, contoh jaringan, migrasi berkas
js/ttc-dinamika.js      mesin fisika waktu tempuh
js/ttc-emplasemen.js    jalur, wesel, rute, dan konflik rute di stasiun
js/ttc-sinyal.js        sinyal, derivasi petak blok, dan aspek
js/ttc-blok.js          perhitungan blocking time & kapasitas
js/ttc-simop.js         simulasi operasi: kereta tunduk pada sinyal
js/ttc-jadwal.js        generator jadwal & daftar waktu
js/ttc-konflik.js       pemeriksa konflik
js/ttc-gapeka.js        penggambar GAPEKA (SVG)
js/ttc-ekspor.js        ekspor CSV, SVG, PNG
js/ttc-ui.js            antarmuka
```

Berkas proyek disimpan sebagai satu `.json` (format `TTC-Project` versi 2).
Berkas versi 1 dari TTC lama masih dapat dibuka — datanya dimigrasi otomatis.
Pekerjaan juga tersimpan otomatis di browser, jadi tidak hilang bila tab tertutup.

## Catatan lisensi

Seluruh perhitungan dalam aplikasi ini disusun dari rumus terbuka dalam
literatur teknik perkeretaapian. Tidak ada kode, data, atau algoritma yang
diambil dari perangkat lunak simulasi komersial mana pun.
