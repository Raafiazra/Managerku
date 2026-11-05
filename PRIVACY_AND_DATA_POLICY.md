# Kebijakan Privasi dan Prosedur Pengelolaan Data

**Status: DRAFT untuk tinjauan pemilik usaha dan penasihat hukum.** Dokumen ini bukan nasihat hukum, bukan pernyataan sertifikasi GDPR/UU PDP, dan tidak boleh dipublikasikan sebagai kebijakan final sebelum seluruh placeholder serta praktik aktual diverifikasi.

## Informasi yang perlu dilengkapi sebelum publikasi

- Pengendali data: `[nama badan usaha/pengelola dan alamat]`
- Kontak privasi: `[email/nomor resmi]`
- Wilayah layanan dan dasar hukum yang digunakan: `[ditinjau penasihat hukum]`
- Penyedia/pemroses, lokasi database/backup, dan transfer lintas negara: `[diverifikasi pada konsol dan kontrak]`
- Jadwal retensi per kategori: `[disetujui legal/akuntan]`

## Data yang saat ini tampak pada aplikasi

Berdasarkan model kode yang diperiksa, aplikasi dapat menyimpan akun Firebase, kategori/properti/unit dan fasilitas, nama dan nomor WhatsApp penyewa, tanggal mulai/jatuh tempo, catatan ketentuan, invoice (nama penyewa, properti/unit, nominal, tanggal), pembayaran, pengeluaran, serta arsip tahunan. Kode yang diperiksa tidak menunjukkan pengumpulan nomor KTP atau unggahan dokumen identitas. Jangan mulai mengumpulkan KTP atau dokumen sensitif tanpa kebutuhan yang jelas, kontrol akses, retensi, keamanan penyimpanan, dan tinjauan hukum tersendiri.

## Tujuan dan prinsip

Data digunakan untuk administrasi properti, pengelolaan sewa, penagihan/pencatatan pembayaran, komunikasi operasional, dukungan, keamanan, dan pemenuhan kewajiban yang berlaku. Terapkan tujuan terbatas, minimisasi data, akurasi, pembatasan akses, keamanan, retensi terbatas, dan akuntabilitas. Hapus field yang tidak diperlukan.

## Akses dan penyimpanan

- Data cloud disimpan di Firebase/Firestore sesuai konfigurasi proyek; pengelola harus memverifikasi region, subprosesor, kontrol akses, dan pengaturan backup aktual.
- Firestore Rules pada repo membatasi path data menurut UID. Ini tidak membuktikan rules produksi telah sama atau telah diuji.
- Jangan mengirim data pribadi ke log, analitik, sample data, laporan bug, atau ekspor tanpa kebutuhan dan perlindungan yang sesuai.
- Ekspor dan backup dapat memuat data pribadi; batasi akses, enkripsi, masa simpan, dan pemusnahan salinannya.

## Hak dan permintaan subjek data

Sediakan kontak yang dapat menangani permintaan akses, koreksi, ekspor, keberatan, pembatasan, atau penghapusan sesuai hukum yang berlaku. Verifikasi identitas pemohon secara proporsional, catat keputusan dan tenggat, dan jangan membuka data satu penyewa kepada penyewa lain. Permintaan dapat memiliki pengecualian hukum/kontrak; rujuk penasihat hukum sebelum menolak atau menghapus data yang wajib dipertahankan.

## Prosedur penghapusan/retensi data penyewa

1. Terima permintaan melalui kontak resmi dan catat tanggal, pemohon, ruang lingkup, serta dasar permintaan secara terbatas.
2. Verifikasi identitas tanpa meminta dokumen berlebihan. Jangan mengumpulkan KTP hanya untuk mempermudah prosedur.
3. Identifikasi record penyewa, kontrak, pembayaran, deposit, work order, arsip, ekspor, dan backup yang terkait; batasi akses sementara bila ada risiko.
4. Tentukan kewajiban penyimpanan transaksi/kontrak dan potensi sengketa bersama penasihat hukum/akuntan. Jangan menghapus catatan keuangan yang wajib disimpan.
5. Jika penghapusan diizinkan, hapus atau anonimisasi data identitas yang tidak perlu, sambil mempertahankan catatan finansial minimal yang diwajibkan dan tidak lagi mengidentifikasi orang bila memungkinkan.
6. Propagasikan permintaan ke sistem, eksport, dan pemroses yang dikendalikan; jelaskan bahwa backup immutable/retained dapat tetap menyimpan salinan hingga masa retensinya habis dan akan terlindungi dari pemakaian rutin.
7. Catat tindakan, pengecualian, operator, tanggal penyelesaian, dan komunikasi kepada pemohon. Simpan log permintaan dengan minimisasi data.

## Insiden privasi

Segera eskalasi akses tidak sah, kehilangan perangkat, salah kirim ekspor, atau kebocoran ke kontak privasi dan administrator keamanan. Amankan bukti tanpa memperluas akses, batasi insiden, dokumentasikan lini waktu, dan minta penasihat hukum menentukan kewajiban pemberitahuan dan tenggat yang berlaku. Jangan menjanjikan kepatuhan atau menghubungi regulator/subjek sebelum proses yang disetujui.

## Perubahan dan persetujuan

Catat versi, tanggal berlaku, pemilik persetujuan, serta perubahan pemrosesan. Tinjau kebijakan setelah penambahan fitur, penyedia, lokasi data, jenis data sensitif, atau perubahan hukum.
