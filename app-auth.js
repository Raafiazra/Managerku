import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { auth } from "./config/firebase.js";
import { showAlert } from "./Assets/js/dialogs.js";
import { setupPasswordToggles } from "./Assets/js/password-toggle.js";

const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const form = loginForm ?? registerForm;
const errorMessage = document.querySelector("#auth-error");
const resetPasswordButton = document.querySelector("#reset-password-button");
let registrationInProgress = false;

setupPasswordToggles();

if (!form || !errorMessage) {
  throw new Error("Form autentikasi Managerku tidak ditemukan.");
}

if (resetPasswordButton && loginForm) {
  resetPasswordButton.addEventListener("click", async () => {
    const emailInput = loginForm.querySelector("#email");
    if (!emailInput.value.trim()) {
      emailInput.reportValidity();
      return;
    }

    resetPasswordButton.disabled = true;
    errorMessage.textContent = "";
    try {
      await sendPasswordResetEmail(auth, emailInput.value.trim());
      errorMessage.textContent = "Jika akun dengan email tersebut terdaftar, tautan reset password akan dikirim.";
    } catch (error) {
      errorMessage.textContent = `Gagal mengirim tautan reset password: ${error.message}`;
    } finally {
      resetPasswordButton.disabled = false;
    }
  });
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
    await showAlert({
      title: "Pendaftaran berhasil",
      message: "Akun berhasil dibuat!",
      subtext: "Silakan masuk dengan email dan password yang baru didaftarkan."
    });
    window.location.href = "login.html";
  } catch (error) {
    registrationInProgress = false;
    const action = loginForm ? "Login gagal" : "Gagal mendaftar";
    errorMessage.textContent = `${action}: ${error.message}`;
  } finally {
    button.disabled = false;
  }
});
