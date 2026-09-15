# TTC — Perjalanan KA / Course-Service

Dokumen ini mencatat fungsi perjalanan individual yang ditambahkan ke menu **Jadwal**.

## Tujuan

Pola Operasi tetap digunakan untuk membangkitkan banyak perjalanan sekaligus. Modul **Perjalanan KA / Course-Service** digunakan untuk perjalanan individual, KA khusus, perjalanan tambahan, atau koreksi satu KA tanpa menghapus fungsi generator.

## Fungsi

Pada menu Jadwal tersedia:

- **+ Tambah KA**
- **Edit KA**
- **Duplikat KA**
- **Nonaktif / Aktifkan**
- **Hapus KA**
- **Hitung Ulang**
- **Simpan Daftar Waktu**

Identitas perjalanan memuat nomor KA, nama KA, relasi, arah, sarana, jam berangkat awal, hari operasi, pola berhenti, status aktif, dan sumber perjalanan.

## Sumber perjalanan

Setiap perjalanan memiliki atribut:

```text
sumber = manual | generator
```

Perjalanan hasil generator juga menyimpan `polaId`. Perjalanan yang berasal dari generator tetapi kemudian diubah pengguna diberi `diubahManual = true`.

KA manual dipertahankan ketika tombol **Buat Jadwal** dijalankan kembali. KA generator yang sengaja dihapus dicatat dalam `pengecualianGenerator` supaya tidak langsung muncul kembali pada regenerasi berikutnya.

## Status aktif

KA aktif berada di `jadwal.ka` dan dipakai oleh GAPEKA, pemeriksaan konflik, simulasi, serta ekspor.

KA nonaktif dipindahkan ke `jadwal.kaNonaktif`, sehingga tetap tersimpan di proyek tetapi tidak ikut perhitungan operasional. KA dapat diaktifkan kembali dari daftar Jadwal.

## Daftar Waktu per stasiun

Untuk setiap titik perjalanan disimpan:

```text
kode
nama
km

datang              program datang
berangkat            program berangkat
berhenti             berhenti / langsung
jalur                 nomor jalur
wt                    tambahan waktu manual (detik)

datangAktual         realisasi datang
berangkatAktual      realisasi berangkat
```

Program dan realisasi tidak saling menimpa. Deviasi datang dan berangkat dihitung dari selisih realisasi terhadap program.

Format waktu menerima jam lebih dari 24, misalnya `25:14`.

## Hitung Ulang

**Hitung Ulang** menghitung ulang perjalanan memakai lintasan, sarana, parameter WT, serta pola berhenti yang tersimpan. Data jalur, WT manual, dan realisasi yang sudah dimasukkan dipertahankan.

## Hapus KA

Sebelum menghapus, TTC menampilkan nomor KA, relasi, dan jam keberangkatan untuk konfirmasi. Setelah dihapus, perjalanan tidak lagi masuk Daftar Waktu aktif, GAPEKA, konflik, simulasi, dan ekspor.

## Kompatibilitas

Proyek lama yang belum memiliki atribut Course-Service tetap dapat dibaca. Saat digunakan, TTC melengkapi atribut baru secara bertahap tanpa mengubah waktu program lama.
