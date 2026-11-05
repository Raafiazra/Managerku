export class AuthView {
  constructor(documentRef = document) {
    this.loginForm = documentRef.querySelector("#login-form");
    this.registerForm = documentRef.querySelector("#register-form");
    this.form = this.loginForm ?? this.registerForm;
    this.errorMessage = documentRef.querySelector("#auth-error");
    this.resetPasswordButton = documentRef.querySelector("#reset-password-button");
  }

  get isLogin() {
    return Boolean(this.loginForm);
  }

  get emailInput() {
    return this.form?.querySelector("#email");
  }

  get passwordInput() {
    return this.form?.querySelector("#password");
  }

  get submitButton() {
    return this.form?.querySelector('button[type="submit"]');
  }

  get email() {
    return this.emailInput?.value.trim() ?? "";
  }

  get password() {
    return this.passwordInput?.value ?? "";
  }

  showError(message) {
    this.errorMessage.textContent = message;
  }

  setSubmitting(isSubmitting) {
    this.submitButton.disabled = isSubmitting;
  }
}
