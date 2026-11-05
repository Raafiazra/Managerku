import test from "node:test";
import assert from "node:assert/strict";
import { authErrorMessage } from "../src/services/auth-error-message.js";

test("auth errors use consistent Indonesian messages", () => {
  assert.equal(authErrorMessage({ code: "auth/user-not-found" }), "Email atau password salah.");
  assert.equal(authErrorMessage({ code: "auth/email-already-in-use" }), "Email ini sudah terdaftar.");
  assert.equal(
    authErrorMessage({ code: "auth/unauthorized-domain" }),
    "Domain ini belum diizinkan di Firebase Authentication > Authorized domains."
  );
});

test("unknown auth errors retain their explicit message", () => {
  assert.equal(authErrorMessage({ message: "Firebase unavailable" }), "Firebase unavailable");
  assert.equal(authErrorMessage({}), "Autentikasi gagal. Silakan coba lagi.");
});

test("Firestore permission errors provide actionable guidance", () => {
  const expected = "Akses Firestore ditolak. Pastikan firestore.rules sudah dipublikasikan.";
  assert.equal(authErrorMessage({ code: "permission-denied" }), expected);
  assert.match(authErrorMessage({ code: "firestore/permission-denied" }), /sudah dipublikasikan/);
});
