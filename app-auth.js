import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { auth } from "./config/firebase.js";

const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const form = loginForm ?? registerForm;
const errorMessage = document.querySelector("#auth-error");
let registrationInProgress = false;

if (!form || !errorMessage) {
  throw new Error("Form autentikasi Managerku tidak ditemukan.");
}

onAuthStateChanged(auth, (user) => {
  if (user && !registrationInProgress) window.location.replace("dashboard.html");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  const email = form.querySelector("#email").value.trim();
  const password = form.querySelector("#password").value;

  button.disabled = true;
  errorMessage.textContent = "";

  try {
    if (loginForm) {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "dashboard.html";
      return;
    }

    registrationInProgress = true;
    await createUserWithEmailAndPassword(auth, email, password);
    await signOut(auth);
    alert("Akun berhasil dibuat!");
    window.location.href = "login.html";
  } catch (error) {
    registrationInProgress = false;
    const action = loginForm ? "Login gagal" : "Gagal mendaftar";
    errorMessage.textContent = `${action}: ${error.message}`;
  } finally {
    button.disabled = false;
  }
});
