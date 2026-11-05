# Prosedur Backup dan Pemulihan Firebase/Firestore

## Tujuan dan batasan

Prosedur ini adalah template operasional untuk administrator proyek. Backup belum dapat dianggap aktif hanya karena dokumen ini ada. Verifikasi fitur yang tersedia, lokasi database, IAM, biaya, retensi, serta kebijakan organisasi di Google Cloud/Firebase Console sebelum mengandalkan backup.

Pisahkan:

1. **Backup terkelola Firestore** untuk pemulihan database pada titik waktu/retensi yang dikonfigurasi.
2. **Ekspor Firestore ke Cloud Storage** untuk salinan portabel/arsip. Ekspor bukan backup otomatis kecuali dijadwalkan, dipantau, dan diuji.
3. **Ekspor JSON aplikasi** (mis. arsip laporan tahunan) yang bukan salinan lengkap database dan tidak menggantikan backup Firestore.

## Penanggung jawab dan akses

- Administrator proyek menyetujui jadwal, retensi, lokasi bucket, biaya, akses IAM, dan pemulihan.
- Gunakan akun organisasi dengan MFA dan hak minimum yang diperlukan; jangan membagikan service-account key.
- Simpan manifest backup (project/database, waktu UTC, jenis, lokasi, hasil, checksum bila tersedia, pelaksana) tanpa data penyewa.

## Menyiapkan backup

- [ ] Identifikasi project ID, database Firestore, lokasi, klasifikasi data, dan RPO/RTO yang disetujui.
- [ ] Konfigurasikan backup/point-in-time recovery terkelola jika tersedia dan disetujui untuk database tersebut.
- [ ] Pilih retensi sesuai kebutuhan hukum/kontrak dan biaya; jangan menetapkan retensi universal tanpa tinjauan legal.
- [ ] Buat Cloud Storage bucket pada lokasi yang didukung oleh Firestore, dengan akses terbatas, enkripsi, lifecycle policy, dan audit logging.
- [ ] Pastikan IAM untuk export/import hanya diberikan kepada operator yang memerlukan.
- [ ] Jadwalkan ekspor sesuai kebutuhan. Perintah administratif yang umum untuk ekspor adalah `gcloud firestore export gs://BUCKET/PREFIX --project=PROJECT_ID`; verifikasi sintaks/opsi dan database yang ditargetkan dengan dokumentasi Google Cloud terkini sebelum menjalankan.
- [ ] Pantau hasil job, kegagalan, ukuran, akses bucket, dan biaya. Jangan menyimpan kredensial di skrip atau repository.
- [ ] Verifikasi backup berada di lokasi yang benar dan terlindungi; catat hasil pada manifest.

## Pemulihan (disaster recovery)

1. Deklarasikan insiden dan tunjuk incident commander serta operator pemulihan.
2. Catat project/database, backup yang dipilih, waktu pemulihan, kehilangan data yang diperkirakan, dan persetujuan pemilik data.
3. Utamakan restore ke proyek/database staging terisolasi. Jangan menimpa produksi saat diagnosis.
4. Ikuti mekanisme restore resmi untuk jenis backup yang dipakai. Untuk ekspor, gunakan prosedur import Firestore yang sesuai dan pastikan target project/database benar.
5. Validasi jumlah koleksi/dokumen, hak akses lintas pengguna, login, hubungan catatan, totals keuangan sampel, dan timestamp terhadap manifest; gunakan data uji yang tidak sensitif.
6. Minta persetujuan pemilik layanan sebelum cutover. Dokumentasikan downtime, kemungkinan data setelah titik backup hilang, dan strategi rekonsiliasi.
7. Setelah cutover, pantau error, akses, biaya, dan integritas data. Jangan menghapus sumber/backup sebelum masa verifikasi selesai.
8. Catat hasil, akar masalah, komunikasi pengguna, dan tindakan pencegahan.

## Latihan pemulihan

- [ ] Jalankan latihan staging berkala (sekurangnya sesuai RPO/RTO organisasi).
- [ ] Ukur waktu restore aktual dan buktikan backup dapat digunakan, bukan hanya berhasil dibuat.
- [ ] Uji akses data setelah restore menggunakan akun A/B dan Firestore Rules.
- [ ] Perbarui daftar kontak, runbook, IAM, dan estimasi biaya setelah latihan.

## Catatan keamanan

- Backup dapat memuat data identitas/keuangan penyewa: batasi akses dan retensi setara atau lebih ketat daripada database produksi.
- Jangan menaruh dump data riil dalam Git, tiket publik, chat, atau perangkat lokal tanpa enkripsi dan izin.
- Menghapus data di aplikasi tidak otomatis menghapus salinan backup yang masih dalam retensi. Prosedur penghapusan harus menjelaskan batas ini kepada pemilik data.
- Perintah dan UI Google Cloud dapat berubah; administrator harus merujuk dokumentasi resmi terbaru sebelum operasi produksi.
