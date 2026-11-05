# Checklist Pengujian Keamanan Firebase

Dokumen ini adalah checklist operasional. Isi repo bukan bukti bahwa konfigurasi produksi sama dengan konfigurasi yang diperiksa. Lakukan pengujian dengan persetujuan pemilik proyek dan akun uji; jangan menguji atau membaca data penyewa nyata tanpa kebutuhan dan otorisasi.

## Sebelum pengujian

- [ ] Catat project ID, database, environment (staging/produksi), tanggal, pelaksana, dan tiket persetujuan.
- [ ] Pastikan staging memiliki aturan dan konfigurasi yang setara dengan produksi.
- [ ] Buat dua akun uji terpisah (A dan B) tanpa data pribadi nyata.
- [ ] Siapkan prosedur rollback dan kontak administrator sebelum menerbitkan rules.
- [ ] Periksa Firebase Console → Firestore Database → Rules dan bandingkan dengan `firestore.rules` pada commit yang akan dipakai.
- [ ] Pastikan Firebase Authentication provider, Authorized domains, API key restriction, dan IAM ditinjau oleh administrator.

## Uji Firestore Rules

Gunakan Firebase Emulator Suite/Rules Unit Testing untuk kasus negatif. Uji operasi produksi hanya melalui akun uji dan jalur aplikasi yang disetujui; jangan mengirim payload eksploratif terhadap data produksi.

| Kasus | Hasil yang diharapkan |
|---|---|
| Permintaan tanpa autentikasi membaca/menulis `users/{uid}/tenants/*` atau `invoices/*` | Ditolak |
| Akun A membaca/menulis koleksi yang diizinkan (termasuk `invoices`) di `users/A` | Diizinkan sesuai aplikasi |
| Akun A membaca/menulis data pada `users/B` | Ditolak |
| Pengguna mencoba koleksi di luar allowlist | Ditolak |
| Admin membandingkan rules yang diterbitkan dengan file repo | Sama, atau perbedaan terdokumentasi dan disetujui |
| Payload berisi field/tipe/ukuran tidak sesuai kontrak data | Ditolak setelah validasi skema ditambahkan |

Rules saat ini mengikat path pengguna ke `request.auth.uid` dan membatasi nama koleksi. Rules juga memberi akses baca/tulis pada dokumen dalam koleksi yang diizinkan; validasi field dan tipe data perlu ditambahkan jika aplikasi memerlukan batasan skema di sisi server.

## Uji autentikasi dan konfigurasi klien

- [ ] Login/logout, persistensi sesi, reset password, dan penolakan domain tidak sah diuji di staging.
- [ ] Domain produksi saja yang diperlukan terdaftar pada Authorized domains.
- [ ] API key klien dibatasi ke referrer/API yang diperlukan bila kompatibel dengan layanan.
- [ ] API key Firebase Web diperlakukan sebagai konfigurasi publik, bukan secret atau pengganti Firestore Rules.
- [ ] Tidak ada service-account key atau kredensial server pada bundle, `.env` terlacak, log, atau artifacts.

## Pemantauan dan tindak lanjut

- [ ] Tinjau Firebase Authentication, Firestore usage, audit logs yang tersedia, kuota, dan billing alerts.
- [ ] Tinjau akun staf/admin dan hak IAM dengan prinsip least privilege.
- [ ] Simpan tanggal, hasil, bukti yang tidak memuat data sensitif, temuan, pemilik tindakan, dan target penyelesaian.
- [ ] Ulangi checklist setelah perubahan rules, skema, provider autentikasi, atau domain.
- [ ] Jika ada akses lintas akun atau paparan data, hentikan perubahan terkait, simpan bukti aman, dan ikuti `PRODUCT_LIMITATIONS_AND_SUPPORT.md`.

Checklist ini bukan penetration test, audit independen, atau jaminan keamanan. Temuan yang memerlukan interpretasi rules atau insiden harus ditangani administrator Firebase/ahli keamanan.

## Backup dan pemulihan

- [ ] Pastikan backup/PITR atau ekspor terjadwal benar-benar dikonfigurasi, dipantau, dan memiliki retensi serta akses IAM yang disetujui; dokumen saja tidak mengaktifkan backup.
- [ ] Catat RPO/RTO, project/database, lokasi backup, operator, serta persetujuan perubahan sebelum operasi.
- [ ] Latih pemulihan terlebih dahulu di staging terisolasi, validasi integritas sampel dan Rules lintas akun, lalu minta persetujuan sebelum cutover produksi.
- [ ] Jangan menyimpan dump Firestore atau data penyewa di Git/tiket/chat; terapkan kontrol akses, enkripsi, dan retensi.
- [ ] Ikuti langkah rinci pada [FIREBASE_BACKUP_PROCEDURE.md](./FIREBASE_BACKUP_PROCEDURE.md) dan prosedur insiden pada [PRODUCT_LIMITATIONS_AND_SUPPORT.md](./PRODUCT_LIMITATIONS_AND_SUPPORT.md).
