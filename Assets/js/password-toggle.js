export function setupPasswordToggles(root = document) {
  root.addEventListener("click", (event) => {
    const button = event.target.closest(".toggle-password");
    if (!button || !root.contains(button)) return;

    const targetId = button.dataset.target;
    const input = targetId
      ? root.getElementById(targetId)
      : button.parentElement.querySelector('input[type="password"], input[type="text"]');
    if (!input) return;

    const isVisible = input.type === "password";
    input.type = isVisible ? "text" : "password";
    button.classList.toggle("is-visible", isVisible);
    button.setAttribute("aria-pressed", String(isVisible));
    button.setAttribute("aria-label", isVisible ? "Sembunyikan password" : "Tampilkan password");
    button.textContent = isVisible ? "◎" : "◉";
  });
}
