import { showAlert } from "../../Assets/js/dialogs.js";
import { authErrorMessage } from "../services/auth-error-message.js";

export class AuthPageController {
  #authService;
  #view;
  #registrationInProgress = false;
  #redirectingToApp = false;

  constructor(authService, view) {
    this.#authService = authService;
    this.#view = view;
  }

  initialize() {
    const view = this.#view;
    if (!view.form || !view.errorMessage) {
      throw new Error("Form autentikasi Managerku tidak ditemukan.");
    }

    view.resetPasswordButton?.addEventListener("click", () => this.#sendResetLink());
    this.#authService.observeState((user) => {
      const currentPage = window.location.pathname.split("/").pop();
      const isAuthPage = currentPage === "login.html" || currentPage === "register.html";
      if (user && isAuthPage && !this.#registrationInProgress && !this.#redirectingToApp) {
        this.#redirectingToApp = true;
        window.location.replace("index.html");
      }
    });
    view.form.addEventListener("submit", (event) => this.#submit(event));
  }

  async #sendResetLink() {
    const { resetPasswordButton, emailInput } = this.#view;
    if (!emailInput.value.trim()) {
      emailInput.reportValidity();
      return;
    }

    resetPasswordButton.disabled = true;
    this.#view.showError("");
    try {
      await this.#authService.sendPasswordReset(emailInput.value.trim());
      this.#view.showError("Jika akun dengan email tersebut terdaftar, tautan reset password akan dikirim.");
    } catch (error) {
      this.#view.showError(`Gagal mengirim tautan reset password: ${authErrorMessage(error)}`);
    } finally {
      resetPasswordButton.disabled = false;
    }
  }

  async #submit(event) {
    event.preventDefault();
    const view = this.#view;
    view.setSubmitting(true);
    view.showError("");

    try {
      if (view.isLogin) {
        await this.#authService.signIn(view.email, view.password);
        return;
      }

      this.#registrationInProgress = true;
      await this.#authService.createAccount(view.email, view.password);
      await this.#authService.signOut();
      await showAlert({
        title: "Pendaftaran berhasil",
        message: "Akun berhasil dibuat!",
        subtext: "Silakan masuk dengan email dan password yang baru didaftarkan."
      });
      window.location.href = "login.html";
    } catch (error) {
      this.#registrationInProgress = false;
      const action = view.isLogin ? "Login gagal" : "Gagal mendaftar";
      view.showError(`${action}: ${authErrorMessage(error)}`);
    } finally {
      view.setSubmitting(false);
    }
  }
}
