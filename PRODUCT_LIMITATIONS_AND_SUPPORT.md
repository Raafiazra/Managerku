# Batasan Produk, Dukungan, dan Respons Insiden

## Batasan produk saat ini

Managerku adalah aplikasi pencatatan operasional properti tahap awal. Kode yang diperiksa mendukung pengelolaan properti/unit/fasilitas/penyewa, invoice persisten per periode, pencatatan DP/pelunasan/sewa rutin dan pengeluaran dasar, status jatuh tempo/pengingat manual melalui WhatsApp, ringkasan sederhana, dan arsip tahunan.

Refund dapat diproses untuk transaksi pemasukan yang sudah tercatat: pemasukan tetap dipertahankan, pengeluaran refund ditambahkan, invoice terkait ditandai REFUNDED, dan sewa dibatalkan. Invoice yang belum dibayar dapat dibatalkan tanpa pengeluaran. Invoice dibuat ketika penyewa didaftarkan dan dapat dicetak dari dashboard; pembuatan invoice berulang otomatis, pengiriman tagihan terjadwal, penomoran terpusat lintas akun, serta pengarsipan invoice batal/refund belum dikembangkan sebagai modul pelaporan tersendiri.

Fitur berikut belum dianggap tersedia/terverifikasi sebagai kemampuan produksi:

- General ledger berpasangan yang persisten, bagan akun dan rekonsiliasi bank.
- Deposit sewa dan penyelesaiannya yang terintegrasi dengan transaksi penyewa.
- Penagihan/invoice otomatis, pengingat otomatis terjadwal, serta laporan tunggakan berbasis tagihan terbit.
- Lifecycle kontrak lengkap dan work order yang tersimpan di Firestore.
- Audit trail append-only, ekspor laporan CSV/PDF, role-based access untuk tim.
- Backup terjadwal dan pemulihan yang telah diuji.
- Sertifikasi pembukuan, nasihat pajak/hukum, atau kepatuhan GDPR/UU PDP yang disertifikasi.

Modul di `src/services/property-operations.js` adalah **prototipe logika domain tanpa persistensi/UI** untuk menguji konsep ledger, deposit, status kontrak, tunggakan, dan tiket perbaikan. Jangan gunakan output-nya untuk pembukuan resmi atau data produksi sebelum tinjauan akuntan, desain skema/migrasi, Rules, audit trail, dan uji pemulihan.

## Kebijakan dukungan (template untuk dilengkapi)

- Kanal resmi: `[isi email/nomor/form dukungan]`
- Jam layanan dan zona waktu: `[isi]`
- Pemilik triase dan eskalasi: `[isi]`
- Target respons (bukan jaminan penyelesaian): `[isi berdasarkan kapasitas]`
- Versi aplikasi/build yang didukung: `[isi]`

Saat melaporkan masalah, sertakan langkah reproduksi, waktu dan zona waktu, versi/browser, serta ID record sintetis bila tersedia. Jangan mengirim password, API key, token, KTP, nomor rekening, isi kontrak, atau ekspor berisi data penyewa. Dukungan tidak menggantikan nasihat hukum, pajak, akuntansi, atau layanan darurat.

## Respons insiden

1. **Terima dan triase:** catat waktu UTC, pelapor, dampak, sistem/akun yang terpengaruh, dan tingkat urgensi; hindari menyalin data sensitif ke tiket.
2. **Tentukan komandan:** tunjuk incident commander, administrator Firebase, pemilik produk, dan kontak privasi/hukum bila ada data pribadi.
3. **Batasi dampak:** gunakan prosedur resmi untuk mencabut sesi/kredensial yang terdampak, menonaktifkan akses/fitur, atau membatasi rules. Jangan melakukan perubahan destruktif tanpa persetujuan dan rencana rollback.
4. **Amankan bukti:** simpan log/audit yang relevan dengan akses minimum dan chain-of-custody; jangan menyebarkan dump produksi.
5. **Pulihkan dengan aman:** gunakan `FIREBASE_BACKUP_PROCEDURE.md`; uji restore di staging sebelum cutover.
6. **Komunikasi:** pemilik usaha dan penasihat hukum menentukan pemberitahuan internal/eksternal serta kewajiban hukum. Jangan menyatakan insiden selesai sebelum verifikasi.
7. **Tutup dan perbaiki:** dokumentasikan akar masalah, dampak, tindakan, persetujuan, dan follow-up; lakukan post-incident review tanpa menyalahkan individu.

## Latihan dan tata kelola

- Uji backup/restore, kontak, dan jalur eskalasi secara berkala.
- Tinjau akses Firebase/IAM dan Firestore Rules setiap perubahan besar atau perubahan personel.
- Simpan postmortem tanpa data pribadi yang tidak perlu.
- Tetapkan pemilik untuk setiap aksi dan tanggal tinjauan dokumen.
