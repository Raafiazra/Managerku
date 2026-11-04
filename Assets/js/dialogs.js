const $ = (selector) => document.querySelector(selector);

const modal = $("#universalModal");
const modalIcon = $("#modalIcon");
const modalTitle = $("#modalTitle");
const modalBody = $("#modalBodyText");
const modalSubtext = $("#modalSubText");
const modalInput = $("#modalInput");
const secondaryButton = $("#btnModalSecondary");
const primaryButton = $("#btnModalPrimary");
const toastContainer = $("#toastContainer");
let resolveDialog = null;
let returnFocus = null;

if (!modal || !modalIcon || !modalTitle || !modalBody || !modalSubtext ||
  !modalInput || !secondaryButton || !primaryButton || !toastContainer) {
  throw new Error("Komponen dialog Managerku tidak ditemukan pada halaman.");
}

function closeDialog(result) {
  if (!resolveDialog) return;
  const resolve = resolveDialog;
  resolveDialog = null;
  modal.classList.add("hidden");
  document.body.classList.remove("dialog-open");
  resolve(result);
  returnFocus?.focus();
  returnFocus = null;
}

function openDialog({
  type,
  mode,
  message,
  subtext = "",
  title,
  icon,
  primaryLabel,
  secondaryLabel = "Batal",
  defaultValue = "",
  inputLabel = "Nilai",
  required = false
}) {
  if (resolveDialog) closeDialog(null);
  modalTitle.textContent = title;
  modalBody.textContent = message;
  modalSubtext.textContent = subtext;
  modalSubtext.classList.toggle("hidden", !subtext);
  modalIcon.textContent = icon;
  modalIcon.className = `modal-icon ${type}`;
  modal.dataset.type = type;
  modal.dataset.mode = mode;
  modal.setAttribute("role", mode === "alert" ? "alertdialog" : "dialog");
  modalInput.value = defaultValue;
  modalInput.setAttribute("aria-label", inputLabel);
  modalInput.classList.toggle("hidden", mode !== "prompt");
  modalInput.required = mode === "prompt" && required;
  secondaryButton.textContent = secondaryLabel;
  secondaryButton.classList.toggle("hidden", mode === "alert");
  primaryButton.textContent = primaryLabel;

  returnFocus = document.activeElement;
  document.body.classList.add("dialog-open");
  modal.classList.remove("hidden");
  (mode === "prompt" ? modalInput : mode === "alert" ? primaryButton : secondaryButton).focus();

  return new Promise((resolve) => {
    resolveDialog = resolve;
  });
}

export function showConfirm({
  message,
  subtext = "",
  title = "Konfirmasi tindakan",
  actionLabel = "Ya, Lanjutkan",
  cancelLabel = "Batal"
}) {
  return openDialog({
    type: "warning",
    mode: "confirm",
    message,
    subtext,
    title,
    icon: "⚠️",
    primaryLabel: actionLabel,
    secondaryLabel: cancelLabel
  });
}

export async function showAlert({ message, subtext = "", title = "Informasi", actionLabel = "Tutup" }) {
  await openDialog({
    type: "info",
    mode: "alert",
    message,
    subtext,
    title,
    icon: "ℹ️",
    primaryLabel: actionLabel
  });
}

export function showPrompt({
  message,
  subtext = "",
  title = "Masukkan informasi",
  actionLabel = "Simpan",
  cancelLabel = "Batal",
  defaultValue = "",
  inputLabel = "Nilai",
  required = false
}) {
  return openDialog({
    type: "prompt",
    mode: "prompt",
    message,
    subtext,
    title,
    icon: "✏️",
    primaryLabel: actionLabel,
    secondaryLabel: cancelLabel,
    defaultValue,
    inputLabel,
    required
  });
}

secondaryButton.addEventListener("click", () => closeDialog(null));
primaryButton.addEventListener("click", () => {
  if (modal.dataset.mode === "alert") {
    closeDialog(undefined);
  } else if (modal.dataset.mode === "prompt") {
    if (modalInput.reportValidity()) closeDialog(modalInput.value);
  } else {
    closeDialog(true);
  }
});
modal.addEventListener("click", (event) => {
  if (event.target === modal && modal.dataset.mode !== "alert") closeDialog(null);
});
modal.addEventListener("keydown", (event) => {
  if (!resolveDialog) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeDialog(modal.dataset.mode === "alert" ? undefined : null);
    return;
  }
  if (event.key === "Enter" && event.target === modalInput && !event.isComposing) {
    event.preventDefault();
    primaryButton.click();
    return;
  }
  if (event.key === "Tab") {
    const focusable = [modalInput, secondaryButton, primaryButton]
      .filter((element) => !element.classList.contains("hidden"));
    const currentIndex = focusable.indexOf(document.activeElement);
    const nextIndex = event.shiftKey
      ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
      : (currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
    event.preventDefault();
    focusable[nextIndex].focus();
  }
});

export function showToast(message, { type = "info", duration = 3200 } = {}) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");

  const text = document.createElement("span");
  text.textContent = message;
  const closeButton = document.createElement("button");
  closeButton.className = "toast-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Tutup notifikasi");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", () => toast.remove());

  toast.append(text, closeButton);
  toastContainer.append(toast);
  if (duration > 0) setTimeout(() => toast.remove(), duration);
}
