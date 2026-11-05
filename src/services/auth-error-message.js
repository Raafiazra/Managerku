const authErrorMessages = {
  "auth/invalid-api-key": "Konfigurasi Firebase tidak valid. Periksa variabel VITE_FIREBASE_*.",
  "auth/unauthorized-domain": "Domain ini belum diizinkan di Firebase Authentication > Authorized domains.",
  "auth/email-already-in-use": "Email ini sudah terdaftar.",
  "auth/invalid-email": "Format email tidak valid.",
  "auth/invalid-credential": "Email atau password salah.",
  "auth/wrong-password": "Email atau password salah.",
  "auth/user-not-found": "Email atau password salah.",
  "auth/user-disabled": "Akun ini dinonaktifkan.",
  "auth/weak-password": "Password terlalu lemah. Gunakan minimal 8 karakter.",
  "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi beberapa saat.",
  "auth/network-request-failed": "Tidak dapat terhubung ke Firebase. Periksa koneksi internet.",
  "auth/operation-not-allowed": "Metode Email/Password belum diaktifkan pada Firebase Authentication.",
  "auth/requires-recent-login": "Sesi sudah lama. Keluar lalu masuk kembali sebelum melakukan tindakan ini.",
  "permission-denied": "Akses Firestore ditolak. Pastikan firestore.rules sudah dipublikasikan.",
  "firestore/permission-denied": "Akses Firestore ditolak. Pastikan firestore.rules sudah dipublikasikan dan mencakup koleksi akun.",
  "unauthenticated": "Sesi autentikasi berakhir. Silakan masuk kembali."
};

export function authErrorMessage(error) {
  return authErrorMessages[error?.code] ?? error?.message ?? "Autentikasi gagal. Silakan coba lagi.";
}
