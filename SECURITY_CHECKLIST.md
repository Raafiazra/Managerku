# Checklist Keamanan Proyek

## Status repositori

- [x] `.gitignore` mengabaikan `.env`, file environment lokal, direktori dependensi/build, log, cache Python, serta cache editor.
- [x] Tidak ditemukan file `.env` terlacak di indeks Git lokal saat diperiksa.
- [x] Pemeriksaan pola kredensial pada riwayat Git lokal tidak menemukan pola umum kunci server. Ini bukan pengganti pemindaian menyeluruh pada seluruh riwayat remote.
- [x] API key Firebase di `config/firebase.js` merupakan konfigurasi klien, bukan kredensial server.
- [x] Commit `.gitignore`: `60555df` pada `main`.
- [x] Handoff untuk administrator tersedia di [GCP-FIREBASE-SECURITY-HANDOFF.md](./GCP-FIREBASE-SECURITY-HANDOFF.md).

## Firestore

- [x] Rules di repositori mewajibkan autentikasi.
- [x] Rules mencocokkan UID pemanggil dengan pemilik data.
- [x] Rules hanya mengizinkan koleksi yang tercantum secara eksplisit.
- [ ] Administrator membandingkan rules yang diterbitkan di Firebase Console dengan `firestore.rules`.
- [ ] Uji akses sah dan penolakan akses lintas pengguna/tanpa autentikasi pada staging atau Firebase Emulator Suite.

> Status rules di repositori tidak membuktikan rules yang sedang diterbitkan pada proyek Firebase.

## Tindakan administrator GCP/Firebase

- [ ] Tinjau pembatasan HTTP referrer pada Firebase API key untuk domain aplikasi yang benar-benar digunakan.
- [ ] Tinjau pembatasan API key dan pastikan layanan autentikasi serta Firestore yang diperlukan tetap berfungsi.
- [ ] Uji aplikasi setelah pembatasan diterapkan, termasuk memastikan domain yang tidak diizinkan ditolak.
- [ ] Jalankan pemindai rahasia yang disetujui terhadap seluruh riwayat remote.
- [ ] Jika kredensial server ditemukan terekspos, cabut/rotasi terlebih dahulu dan koordinasikan pembersihan riwayat sesuai kebijakan organisasi.

## Pengelolaan environment

- [x] `.env` dan file environment lokal diabaikan Git.
- [ ] Jika aplikasi mulai memakai environment variables, tambahkan `.env.example` berisi nama variabel dan nilai contoh non-rahasia saja.

API key klien bukan kontrol akses. Gunakan autentikasi, Firestore Rules, dan kontrol sisi server yang sesuai untuk melindungi data.
