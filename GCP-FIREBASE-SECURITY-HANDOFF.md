# Handoff Keamanan GCP dan Firebase

Dokumen ini merangkum kondisi keamanan yang dapat diverifikasi dari repositori dan tindakan yang memerlukan akses ke Google Cloud Console atau Firebase Console.

## Status repositori

- `.gitignore` mengabaikan `.env`, berkas environment lokal, direktori dependensi/build, log, cache Python, serta cache editor.
- Pemeriksaan lokal tidak menemukan berkas `.env` terlacak.
- Konfigurasi Firebase di `config/firebase.js` membaca nilai build-time Vite. `.env.example` hanya berisi nama variabel tanpa nilai proyek.
- Riwayat Git lokal yang diperiksa tidak menunjukkan pola umum kunci server. API key Firebase web adalah konfigurasi klien publik, bukan kredensial server. Jangan menaruh service-account key atau kredensial server di frontend.
- Aturan yang tersimpan di `firestore.rules` mewajibkan autentikasi, mencocokkan UID dengan pemilik data, dan membatasi akses ke koleksi yang disebutkan secara eksplisit.
- Commit pengabaian berkas sensitif: `60555df` pada `main`.

> Aturan di repositori tidak membuktikan aturan yang sedang terpasang di Firebase. Admin harus membandingkan aturan yang diterbitkan di Firebase Console dengan `firestore.rules`.

## Tindakan untuk Admin GCP/Firebase

### 1. Verifikasi Firestore Rules yang diterbitkan

1. Buka Firebase Console → Firestore Database → Rules.
2. Bandingkan aturan yang diterbitkan dengan `firestore.rules` di repositori.
3. Pastikan akses lintas pengguna ditolak dan pengguna tanpa autentikasi tidak dapat membaca atau menulis data.
4. Uji operasi sah dan tidak sah di proyek staging menggunakan Firebase Emulator Suite atau prosedur pengujian yang disetujui sebelum menerbitkan perubahan ke produksi.

### 2. Batasi Firebase API key

1. Buka Google Cloud Console → APIs & Services → Credentials pada proyek yang benar.
2. Identifikasi API key yang dipakai aplikasi; jangan menyalin nilainya ke dokumentasi atau tiket.
3. Evaluasi pembatasan aplikasi HTTP referrer untuk domain produksi dan domain pengembangan yang diperlukan. Ganti placeholder dengan domain aktual; jangan membatasi ke wildcard yang tidak perlu.
4. Evaluasi pembatasan API berdasarkan layanan yang benar-benar digunakan aplikasi. Pastikan Firebase Authentication dan Firestore tetap berfungsi setelah perubahan.
5. Simpan perubahan dan uji aplikasi dari domain yang diizinkan serta pastikan penggunaan dari domain lain ditolak.

API key Firebase web memang berada di klien. Pembatasan key mengurangi penyalahgunaan, tetapi bukan pengganti autentikasi, Firestore Rules, atau kontrol akses backend.

### 3. Tinjau riwayat kredensial

- Lakukan pemindaian menyeluruh pada seluruh riwayat remote dengan alat pemindai rahasia yang disetujui organisasi.
- Jika kredensial server pernah terungkap, cabut/rotasi kredensial terlebih dahulu, lalu koordinasikan penghapusan riwayat Git dan force-push sesuai kebijakan tim.
- Jangan menganggap pemindaian pola teks lokal sebagai bukti bahwa seluruh riwayat remote bebas rahasia.

### 4. Variabel lingkungan

1. Salin `.env.example` menjadi `.env` dan isi nilai Firebase untuk lingkungan lokal. File `.env` diabaikan Git.
2. Untuk GitHub Pages, rotasi API key yang terekspos di Google Cloud Console terlebih dahulu. Tambahkan variabel repository berikut di GitHub → Settings → Secrets and variables → Actions → Variables: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, dan `VITE_FIREBASE_APP_ID`. `VITE_FIREBASE_MEASUREMENT_ID` bersifat opsional.
3. Jangan masukkan `.env` ke repository. Vite menyematkan nilai `VITE_*` ke kode browser saat build; nilai tersebut dapat dilihat pengguna dan tidak boleh dianggap rahasia.
4. Workflow `.github/workflows/deploy-pages.yml` membangun dan menerbitkan `dist/` pada GitHub Pages. Aktifkan Settings → Pages → Build and deployment → GitHub Actions.
5. Tambahkan domain GitHub Pages situs ke Firebase Console → Authentication → Settings → Authorized domains, kemudian uji login setelah workflow berhasil.
6. Jalankan `npm install`, lalu `npm run dev` untuk lokal. Gunakan `npm run build` untuk menghasilkan situs di `dist/`.
