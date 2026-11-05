import { authService } from "../../src/services/auth-service.js";
import { authErrorMessage } from "../../src/services/auth-error-message.js";
import { DashboardController } from "../../src/controllers/dashboard-controller.js";
import { WorkspaceController } from "../../src/controllers/workspace-controller.js";
import { firestoreService } from "../../src/services/firestore-service.js";
import { getCurrentAppDate, isPaymentActive, localDatabaseService } from "./db.js";
import { flushUserWrites } from "./firestore.js";
import { formatRupiah, getBillingMessage, getBillingStatus, getOverdueReminder, getWhatsAppUrl, isSeverelyOverdue } from "./billing.js";
import { showAlert, showConfirm, showToast } from "./dialogs.js";
import { setupPasswordToggles } from "./password-toggle.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const walletIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v15H6.5A2.5 2.5 0 0 1 4 16.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 7h14a2 2 0 0 1 2 2v2h-5a2 2 0 0 0 0 4h5v1.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M16 13h.01" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>';
const today = getCurrentAppDate;
const dateLabel = (value) => value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "—";

setupPasswordToggles();

const brandLogo = $(".brand-logo");
if (brandLogo) {
  let wiggleTimer;
  brandLogo.addEventListener("click", () => {
    brandLogo.classList.remove("logo-wiggle");
    void brandLogo.offsetWidth;
    brandLogo.classList.add("logo-wiggle");
    clearTimeout(wiggleTimer);
    wiggleTimer = setTimeout(() => brandLogo.classList.remove("logo-wiggle"), 550);
  });
  brandLogo.addEventListener("animationend", () => {
    clearTimeout(wiggleTimer);
    brandLogo.classList.remove("logo-wiggle");
  });
}

let activeView = "dashboard";
let activePropertyId = "all";
let annualYear = null;
let authenticatedUser = null;

function setAuthTab(tab) {
  const isLogin = tab === "login";
  $("#login-tab").classList.toggle("active", isLogin);
  $("#register-tab").classList.toggle("active", !isLogin);
  $("#login-tab").setAttribute("aria-selected", String(isLogin));
  $("#register-tab").setAttribute("aria-selected", String(!isLogin));
  $("#login-form").classList.toggle("hidden", !isLogin);
  $("#register-form").classList.toggle("hidden", isLogin);
  $("#login-form").setAttribute("aria-hidden", String(!isLogin));
  $("#register-form").setAttribute("aria-hidden", String(isLogin));
}

function setAuthOverlayVisible(visible) {
  $("#auth-container").classList.toggle("hidden", !visible);
  document.body.classList.toggle("auth-open", visible);
  $("#app-shell").classList.toggle("hidden", visible);
}

function setAuthStatus(message, { retry = false, busy = false } = {}) {
  $("#auth-status").textContent = message;
  $("#auth-retry-button").classList.toggle("hidden", !retry);
  ["#login-form", "#register-form"].forEach((selector) => {
    $$("input, button", $(selector)).forEach((element) => { element.disabled = busy; });
  });
  $$("[data-auth-tab]").forEach((tab) => { tab.disabled = busy; });
}

const dashboardController = new DashboardController({
  authService,
  databaseService: localDatabaseService,
  firestoreService,
  confirmLocalImport: () => showConfirm({
    title: "Impor data lokal?",
    message: "Ditemukan data Managerku lokal pada perangkat ini. Impor data tersebut ke akun Firebase Anda?",
    subtext: "Data lokal asli tetap disimpan.",
    actionLabel: "Impor Data"
  }),
  onLoading(user) {
    authenticatedUser = user;
    setAuthOverlayVisible(true);
    setAuthStatus("Memuat data akun dari Firestore...", { busy: true });
  },
  onReady(user) {
    $("#auth-user-name").textContent = user.displayName || "Pengelola";
    $("#auth-user-email").textContent = user.email || "Akun Firebase";
    setAuthStatus("");
    setAuthOverlayVisible(false);
    render();
  },
  onError(error) {
    console.error("Tidak dapat memuat workspace Firestore Managerku.", error);
    setAuthStatus(`Data akun gagal dimuat. ${authErrorMessage(error)}`, { retry: true });
    setAuthOverlayVisible(true);
  },
  onSyncError(error) {
    showToast(`Perubahan tersimpan di perangkat, tetapi gagal disinkronkan ke cloud. ${authErrorMessage(error)}`);
  },
  onUnauthenticated() {
    authenticatedUser = null;
    localDatabaseService.setUserStorageScope(null);
    setAuthTab("login");
    setAuthOverlayVisible(true);
    setAuthStatus("");
  }
});
const workspaceController = new WorkspaceController(localDatabaseService);

function setMobileSidebarOpen(open) {
  document.body.classList.toggle("sidebar-open", open);
  $("#mobile-menu-btn").setAttribute("aria-expanded", String(open));
  $("#mobile-menu-btn").setAttribute("aria-label", open ? "Tutup menu navigasi" : "Buka menu navigasi");
  $("#sidebar-overlay").setAttribute("aria-hidden", String(!open));
}

function dataWithRelations() {
  const data = workspaceController.getAll();
  return {
    ...data,
    propertyById: new Map(data.properties.map((item) => [item.id, item])),
    categoryById: new Map(data.categories.map((item) => [item.id, item])),
    unitById: new Map(data.units.map((item) => [item.id, item])),
    tenantByUnit: new Map(data.tenants.map((item) => [item.unitId, item]))
  };
}

function updateSelect(select, options, selected = "all", allLabel = "Semua properti") {
  if (!select) return;
  select.innerHTML = `<option value="all">${escapeHtml(allLabel)}</option>${options.map((item) =>
    `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`
  ).join("")}`;
  select.value = options.some((item) => item.id === selected) ? selected : "all";
}

function renderSidebar(data) {
  const nav = $("#property-nav");
  if (!data.categories.length) {
    nav.innerHTML = `<p class="empty-nav">Belum ada kategori. Mulai dengan setup properti.</p>`;
    return;
  }
  nav.innerHTML = data.categories.map((category) => {
    const properties = data.properties.filter((property) => property.categoryId === category.id);
    return `<div class="category-nav">
      <div class="category-name"><span>${escapeHtml(category.name)}</span><span class="category-actions"><button data-action="add-property" data-category-id="${escapeHtml(category.id)}" title="Tambah properti" aria-label="Tambah properti">＋</button><button data-action="delete-category" data-category-id="${escapeHtml(category.id)}" title="Hapus kategori" aria-label="Hapus kategori">×</button></span></div>
      ${properties.map((property) => `<div class="property-nav-row"><button class="property-link ${activePropertyId === property.id ? "active" : ""}" data-property="${escapeHtml(property.id)}">${escapeHtml(property.name)}</button><button class="property-delete" data-action="delete-property" data-property-id="${escapeHtml(property.id)}" title="Hapus properti" aria-label="Hapus ${escapeHtml(property.name)}">×</button></div>`).join("")}
    </div>`;
  }).join("");
}

function renderOnboardingAction(data) {
  const button = $("#onboarding-action");
  const propertyId = $("#dashboard-filter").value || "all";
  const availableUnits = filteredUnits(data, propertyId).filter((unit) =>
    !data.tenants.some((tenant) => tenant.unitId === unit.id)
  );
  let action = "";
  let label = "";

  if (availableUnits.length) {
    action = "add-tenant";
    label = "3. Tambah Penyewa";
  }

  button.dataset.action = action;
  button.innerHTML = `<span>＋</span> ${label}`;
  button.classList.toggle("hidden", activeView !== "dashboard" || !action);
}

function populateFilters(data) {
  const dashboardSelection = $("#dashboard-filter").value || activePropertyId;
  const unitSelection = $("#unit-filter").value || activePropertyId;
  const financeSelection = $("#finance-filter").value || "all";
  const propertyOptions = data.properties.map((item) => ({ id: item.id, name: item.name }));
  updateSelect($("#dashboard-filter"), propertyOptions, dashboardSelection);
  updateSelect($("#unit-filter"), propertyOptions, unitSelection);
  const financeOptions = [
    { id: "all", name: "Semua properti & kategori" },
    ...data.categories.map((item) => ({ id: `category:${item.id}`, name: `Kategori: ${item.name}` })),
    ...propertyOptions.map((item) => ({ id: `property:${item.id}`, name: `Properti: ${item.name}` }))
  ];
  $("#finance-filter").innerHTML = financeOptions.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
  $("#finance-filter").value = financeOptions.some((item) => item.id === financeSelection) ? financeSelection : "all";

  const currentYear = Number(today().slice(0, 4));
  const years = new Set([currentYear, ...data.archives.map((archive) => archive.year)]);
  [...data.payments, ...data.expenses].forEach((item) => {
    const year = Number(item.date?.slice(0, 4));
    if (Number.isInteger(year)) years.add(year);
  });
  const annualSelect = $("#annual-year");
  annualSelect.innerHTML = [...years].sort((a, b) => b - a)
    .map((year) => `<option value="${year}">${year}</option>`).join("");
  annualYear = Number.isInteger(annualYear) && years.has(annualYear) ? annualYear : currentYear;
  annualSelect.value = String(annualYear);

  $("#date-mode").value = data.dateMode;
  $("#app-date-picker").value = data.customDate ?? today();
  $("#app-date-picker").classList.toggle("hidden", data.dateMode !== "custom");
  $("#reset-date-button").classList.toggle("hidden", data.dateMode !== "custom");
}

function tenantForUnit(data, unit) {
  return data.tenantByUnit.get(unit.id) ?? null;
}

function statusForUnit(data, unit, tenant) {
  if (!tenant) return { code: "VACANT", label: "KOSONG" };
  return getBillingStatus(tenant, data.payments.filter(isPaymentActive));
}

function statusText(status) {
  const labels = {
    PAID: "LUNAS",
    DUE_SOON: "H-3",
    DUE_TODAY: "HARI INI",
    OVERDUE_L1: "TUNGGAKAN",
    OVERDUE_CRITICAL: "KRITIS",
    UPCOMING: "BELUM JATUH TEMPO",
    VACANT: "KOSONG"
  };
  return labels[status.code] ?? status.label;
}

function unitCard(data, unit) {
  const property = data.propertyById.get(unit.propertyId);
  const tenant = tenantForUnit(data, unit);
  const status = statusForUnit(data, unit, tenant);
  const criticalOverdue = tenant && isSeverelyOverdue(status);
  const reminder = tenant ? getOverdueReminder(status) : null;
  const tenantInfo = tenant
    ? `<div class="unit-tenant">${escapeHtml(tenant.name)} · ${escapeHtml(tenant.whatsapp)}</div><div class="unit-meta">Jatuh tempo ${dateLabel(status.dueDate)}</div>${tenant.specialTerms ? `<div class="unit-meta">Ketentuan: ${escapeHtml(tenant.specialTerms)}</div>` : ""}${reminder ? `<div class="unit-meta">Pengingat ke-${reminder.number}${reminder.overdueDays ? ` · terlambat ${reminder.overdueDays} hari` : " · jatuh tempo hari ini"}</div>` : ""}`
    : `<div class="unit-tenant">Belum ada penyewa</div><div class="unit-meta">Tipe ${escapeHtml(unit.type)}</div>`;
  let actions = "";
  if (!tenant) {
    actions = `<button class="button button-primary" data-action="add-tenant" data-unit-id="${escapeHtml(unit.id)}">＋ Tambah penyewa</button>`;
    actions += `<button class="button button-outline" data-action="edit-unit" data-unit-id="${escapeHtml(unit.id)}">Edit unit</button>`;
    actions += `<button class="button button-danger" data-action="delete-unit" data-unit-id="${escapeHtml(unit.id)}">Hapus unit</button>`;
  } else {
    actions = `<button class="button button-outline" data-action="whatsapp" data-tenant-id="${escapeHtml(tenant.id)}">Tagih via WA</button>`;
    if (status.code !== "PAID") actions += `<button class="button button-primary" data-action="mark-paid" data-tenant-id="${escapeHtml(tenant.id)}" data-due-date="${escapeHtml(status.dueDate)}">Tandai lunas</button>`;
    actions += `<button class="button button-outline" data-action="edit-tenant" data-tenant-id="${escapeHtml(tenant.id)}">Edit penyewa</button>`;
    actions += `<button class="button button-outline" data-action="edit-unit" data-unit-id="${escapeHtml(unit.id)}">Edit unit</button>`;
    actions += `<button class="button button-danger" data-action="remove-tenant" data-tenant-id="${escapeHtml(tenant.id)}">Checkout</button>`;
    actions += `<button class="button button-danger" data-action="delete-unit" data-unit-id="${escapeHtml(unit.id)}">Hapus unit</button>`;
  }
  return `<article class="unit-card status-${status.code.toLowerCase().replaceAll("_", "-")}${criticalOverdue ? " status-overdue-90" : ""}">
    <div class="unit-card-top"><span class="unit-name">${escapeHtml(unit.unitName)}</span><span class="badge ${criticalOverdue ? "badge-overdue-90" : `badge-${status.code.toLowerCase().replaceAll("_", "-")}`}">${criticalOverdue ? "MENUNGGAK 3+ BULAN" : statusText(status)}</span></div>
    ${tenantInfo}
    <div class="unit-price">${formatRupiah(unit.price)} <span class="unit-meta">/ bulan</span></div>
    <div class="unit-actions">${actions}</div>
  </article>`;
}

function statCard(label, value, icon, variant, foot, helper = "") {
  return `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon ${variant}">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div>${helper ? `<p class="stat-helper">${helper}</p>` : ""}</article>`;
}

function filteredUnits(data, propertyId) {
  return data.units.filter((unit) => propertyId === "all" || unit.propertyId === propertyId);
}

function propertySetupEmptyState(data) {
  if (!data.categories.length) {
    return `<div class="empty-state"><strong>Mulai kelola bisnis Anda</strong><p>Langkah 1: buat kategori untuk mengelompokkan properti.</p><button class="button button-primary" data-action="add-category">1. Buat Kategori</button></div>`;
  }
  const categoryId = data.categories.length === 1
    ? ` data-category-id="${escapeHtml(data.categories[0].id)}"`
    : "";
  return `<div class="empty-state"><strong>Belum ada properti</strong><p>Langkah 1: tambahkan properti ke kategori Anda.</p><button class="button button-primary" data-action="add-property"${categoryId}>1. Tambah Properti</button></div>`;
}

function renderDashboard(data) {
  const propertyId = $("#dashboard-filter").value || "all";
  const units = filteredUnits(data, propertyId);
  const propertiesInScope = new Set(units.map((unit) => unit.propertyId));
  const paidPayments = data.payments.filter((payment) =>
    isPaymentActive(payment) && (propertyId === "all" || payment.propertyId === propertyId)
  );
  const expenses = data.expenses.filter((expense) => expense.scope === "global" ? propertyId === "all" : propertyId === "all" || propertiesInScope.has(expense.propertyId) || expense.propertyId === propertyId);
  const gross = paidPayments.reduce((sum, item) => sum + item.amount, 0);
  const expenseTotal = expenses.reduce((sum, item) => sum + item.amount, 0);
  const occupied = units.filter((unit) => Boolean(tenantForUnit(data, unit))).length;
  $("#dashboard-stats").innerHTML = [
    statCard("Total pemasukan lunas", formatRupiah(gross), "↗", "green", `${paidPayments.length} transaksi tercatat`, paidPayments.length ? "" : "Data akan muncul setelah kamu mencatat pembayaran pertama."),
    statCard("Total pengeluaran", formatRupiah(expenseTotal), "↘", "orange", `${expenses.length} transaksi pengeluaran`, expenses.length ? "" : "Catat pengeluaran untuk mulai melihat biaya bisnis."),
    statCard("Pendapatan bersih", formatRupiah(gross - expenseTotal), walletIcon, "purple", "Pemasukan lunas dikurangi biaya"),
    statCard("Okupansi", `${units.length ? Math.round((occupied / units.length) * 100) : 0}%`, "▤", "", `${occupied} dari ${units.length} unit terisi`)
  ].join("");

  const overdueTenants = units.flatMap((unit) => {
    const tenant = tenantForUnit(data, unit);
    if (!tenant) return [];
    const status = getBillingStatus(tenant, paidPayments);
    const reminder = getOverdueReminder(status);
    if (!reminder) return [];
    return [{ unit, tenant, status, reminder, property: data.propertyById.get(unit.propertyId) }];
  });
  const alerts = $("#dashboard-alerts");
  alerts.classList.toggle("hidden", !overdueTenants.length);
  alerts.innerHTML = overdueTenants.length
    ? `<div class="dashboard-alert-heading"><div><p class="eyebrow">PENGINGAT JATUH TEMPO</p><h2 id="dashboard-alerts-title">Perlu ditindaklanjuti</h2><p>${overdueTenants.length} penyewa belum melunasi tagihan yang jatuh tempo. Pengingat berulang setiap 3 hari selama dashboard dibuka.</p></div></div><ul class="dashboard-alert-list">${overdueTenants.map(({ unit, tenant, status, reminder, property }) => `<li class="dashboard-alert-item"><span><strong>${escapeHtml(tenant.name)}</strong> · ${escapeHtml(property?.name ?? "Properti")} / ${escapeHtml(unit.unitName)} · Pengingat ke-${reminder.number}${reminder.overdueDays ? ` · ${reminder.overdueDays} hari terlambat` : " · jatuh tempo hari ini"}</span><button class="button button-outline button-sm" data-action="whatsapp" data-tenant-id="${escapeHtml(tenant.id)}">Ingatkan via WA</button></li>`).join("")}</ul>`
    : "";

  const dashboardUnits = $("#dashboard-units");
  dashboardUnits.innerHTML = units.length
    ? units.slice(0, 6).map((unit) => unitCard(data, unit)).join("")
    : !data.properties.length
      ? propertySetupEmptyState(data)
      : `<div class="empty-state"><strong>Belum ada unit</strong><p>Langkah 2: tambahkan unit pada properti Anda.</p><button class="button button-primary" data-action="add-unit">2. Tambah Unit</button></div>`;

  const activity = [
    ...paidPayments.map((item) => ({ ...item, type: "income", label: item.description })),
    ...expenses.map((item) => ({ ...item, type: "expense", label: item.description }))
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  $("#dashboard-activity").innerHTML = activity.length ? activity.map((item) =>
    `<div class="activity-item"><div><div class="activity-label">${escapeHtml(item.label)}</div><div class="activity-sub">${dateLabel(item.date)} · ${item.type === "income" ? "Pemasukan sewa" : "Pengeluaran"}</div></div><div class="activity-amount ${item.type === "income" ? "amount-income" : "amount-expense"}">${item.type === "income" ? "+" : "−"} ${formatRupiah(item.amount)}</div></div>`
  ).join("") : `<div class="empty-state"><strong>Belum ada aktivitas</strong><p>Transaksi sewa dan pengeluaran akan muncul di sini.</p></div>`;
}

function renderUnits(data) {
  const propertyFilter = $("#unit-filter").value || "all";
  const properties = data.properties.filter((property) => propertyFilter === "all" || property.id === propertyFilter);
  const target = $("#units-content");
  if (!properties.length) {
    target.innerHTML = `<div class="panel">${propertySetupEmptyState(data)}</div>`;
    return;
  }
  target.innerHTML = properties.map((property) => {
    const units = data.units.filter((unit) => unit.propertyId === property.id);
    const category = data.categoryById.get(property.categoryId);
    return `<section class="property-group"><div class="property-group-heading"><h2>${escapeHtml(property.name)} <span class="unit-meta">· ${escapeHtml(category?.name ?? "")}</span></h2><span class="property-group-actions">${units.length} unit <button class="text-button" data-action="add-unit" data-property-id="${escapeHtml(property.id)}">＋ Tambah unit</button><button class="button button-danger button-sm" data-action="delete-property" data-property-id="${escapeHtml(property.id)}">Hapus properti</button></span></div><div class="unit-grid">${units.length ? units.map((unit) => unitCard(data, unit)).join("") : `<div class="empty-state"><strong>Belum ada unit di properti ini</strong><p>Tambahkan unit pertama Anda.</p><button class="button button-primary" data-action="add-unit" data-property-id="${escapeHtml(property.id)}">＋ Tambah unit</button></div>`}</div></section>`;
  }).join("");
}

function transactionScope(data, filter) {
  if (filter.startsWith("property:")) return { propertyId: filter.slice(9), categoryId: null };
  if (filter.startsWith("category:")) return { propertyId: null, categoryId: filter.slice(9) };
  return { propertyId: null, categoryId: null };
}

function inPeriod(date, period) {
  const current = today();
  if (period === "month") return date.slice(0, 7) === current.slice(0, 7);
  if (period === "year") return date.slice(0, 4) === current.slice(0, 4);
  return true;
}

function renderFinance(data) {
  const filter = $("#finance-filter").value || "all";
  const period = $("#finance-period").value || "all";
  const scope = transactionScope(data, filter);
  const propertyIds = new Set(data.properties.filter((property) =>
    scope.propertyId ? property.id === scope.propertyId : scope.categoryId ? property.categoryId === scope.categoryId : true
  ).map((property) => property.id));
  const payments = data.payments.filter((item) => propertyIds.has(item.propertyId) && inPeriod(item.date, period));
  const activePayments = payments.filter(isPaymentActive);
  const expenses = data.expenses.filter((item) => {
    if (!inPeriod(item.date, period)) return false;
    if (filter === "all") return true;
    return item.scope !== "global" && propertyIds.has(item.propertyId);
  });
  const income = activePayments.reduce((sum, item) => sum + item.amount, 0);
  const cost = expenses.reduce((sum, item) => sum + item.amount, 0);
  $("#finance-stats").innerHTML = [
    statCard("Total pemasukan", formatRupiah(income), "↗", "green", `${activePayments.length} pembayaran lunas`, activePayments.length ? "" : "Data akan muncul setelah kamu mencatat pembayaran pertama."),
    statCard("Total pengeluaran", formatRupiah(cost), "↘", "orange", `${expenses.length} pengeluaran tercatat`, expenses.length ? "" : "Catat pengeluaran untuk mulai melihat biaya bisnis."),
    statCard("Pendapatan bersih", formatRupiah(income - cost), walletIcon, "purple", "Pemasukan dikurangi pengeluaran")
  ].join("");

  const transactions = [
    ...payments.map((item) => ({
      ...item,
      type: "Pemasukan",
      category: isPaymentActive(item) ? "Sewa lunas" : "Dibatalkan"
    })),
    ...expenses.map((item) => ({ ...item, type: "Pengeluaran", category: item.category }))
  ].sort((a, b) => b.date.localeCompare(a.date));
  $("#transaction-list").innerHTML = transactions.length ? `<table class="transaction-table"><thead><tr><th>Tanggal</th><th>Transaksi</th><th>Properti / cakupan</th><th>Kategori / status</th><th>Nominal</th><th>Aksi</th></tr></thead><tbody>${transactions.map((item) => {
    const property = item.propertyId ? data.propertyById.get(item.propertyId)?.name : null;
    const unitName = item.unitId ? data.unitById.get(item.unitId)?.unitName : item.unitName;
    const coverage = item.type === "Pengeluaran" ? (item.scope === "global" ? "Global" : unitName ? `${property ?? "Properti"} · ${unitName}${item.unitId ? "" : " (unit dihapus)"}` : `${property ?? "Properti"} · Properti`) : `${property ?? "Properti dihapus"}${unitName ? ` · ${unitName}${item.unitId ? "" : " (unit dihapus)"}` : ""}`;
    const isCancelled = item.type === "Pemasukan" && !isPaymentActive(item);
    const action = item.type === "Pemasukan" && !isCancelled
      ? `<button class="button button-danger button-sm" data-action="cancel-payment" data-payment-id="${escapeHtml(item.id)}">Batalkan</button>`
      : isCancelled ? `<span class="transaction-cancelled">Dibatalkan</span>` : "—";
    const sign = isCancelled ? "" : item.type === "Pemasukan" ? "+" : "−";
    return `<tr class="${isCancelled ? "transaction-row-cancelled" : ""}"><td>${dateLabel(item.date)}</td><td>${escapeHtml(item.description)}${isCancelled ? `<div class="transaction-cancel-note">Dibatalkan ${item.cancelledAt ? dateLabel(item.cancelledAt.slice(0, 10)) : ""}</div>` : ""}</td><td>${escapeHtml(coverage)}</td><td class="transaction-type">${escapeHtml(item.category)}</td><td class="${item.type === "Pemasukan" ? "amount-income" : "amount-expense"}">${sign} ${formatRupiah(item.amount)}</td><td>${action}</td></tr>`;
  }).join("")}</tbody></table>` : `<div class="empty-state"><strong>Belum ada transaksi</strong><p>Pembayaran yang ditandai lunas dan pengeluaran akan dicatat di sini.</p></div>`;
}

function reportTransactionsForYear(data, year) {
  const yearPrefix = `${year}-`;
  const properties = new Map(data.properties.map((property) => [property.id, property]));
  const categories = new Map(data.categories.map((category) => [category.id, category]));
  const units = new Map(data.units.map((unit) => [unit.id, unit]));
  const tenants = new Map(data.tenants.map((tenant) => [tenant.id, tenant]));
  return [
    ...data.payments.filter((item) => isPaymentActive(item) && item.date?.startsWith(yearPrefix)).map((item) => {
      const property = properties.get(item.propertyId);
      const unit = units.get(item.unitId);
      return {
        ...item,
        type: "income",
        propertyName: property?.name ?? "Properti dihapus",
        categoryName: categories.get(property?.categoryId)?.name ?? "Tanpa kategori",
        unitName: unit?.unitName ?? item.unitName ?? "",
        tenantName: tenants.get(item.tenantId)?.name ?? ""
      };
    }),
    ...data.expenses.filter((item) => item.date?.startsWith(yearPrefix)).map((item) => {
      const unit = units.get(item.unitId);
      const property = properties.get(item.propertyId) ?? (unit ? properties.get(unit.propertyId) : null);
      return {
        ...item,
        type: "expense",
        propertyName: property?.name ?? (item.scope === "global" ? "Global" : "Properti dihapus"),
        categoryName: categories.get(property?.categoryId)?.name ?? "Tanpa kategori",
        unitName: unit?.unitName ?? item.unitName ?? ""
      };
    })
  ].sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
}

function transactionTable(transactions) {
  if (!transactions.length) return `<div class="empty-state"><strong>Belum ada transaksi</strong><p>Belum ada pemasukan atau pengeluaran pada tahun ini.</p></div>`;
  return `<div class="archive-details"><table class="transaction-table"><thead><tr><th>Tanggal</th><th>Transaksi</th><th>Properti / unit</th><th>Kategori</th><th>Nominal</th></tr></thead><tbody>${transactions.map((item) => {
    const income = item.type === "income";
    const coverage = item.scope === "global" ? "Global" : `${item.propertyName}${item.unitName ? ` · ${item.unitName}` : ""}`;
    const category = income ? item.categoryName : item.expenseCategory ?? item.category ?? "Pengeluaran";
    return `<tr><td>${dateLabel(item.date)}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(coverage)}</td><td class="transaction-type">${escapeHtml(category)}</td><td class="${income ? "amount-income" : "amount-expense"}">${income ? "+" : "−"} ${formatRupiah(item.amount)}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function renderAnnual(data) {
  const year = Number($("#annual-year").value || data.activeYear);
  const currentYear = Number(today().slice(0, 4));
  annualYear = year;
  const archive = data.archives.find((item) => item.year === year);
  const transactions = archive?.transactions ?? reportTransactionsForYear(data, year);
  const income = archive?.totals.income ?? transactions.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const costs = archive?.totals.expenses ?? transactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const archived = Boolean(archive);
  $("#annual-action-title").textContent = archived ? `Laporan ${year} sudah diarsipkan` : `Tutup buku tahun ${year}`;
  $("#annual-action-description").textContent = archived
    ? `Arsip dibuat ${new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(archive.createdAt))}. Tanggal aplikasi tetap mengikuti mode tanggal yang dipilih.`
    : `Tinjau dan simpan snapshot transaksi tahun ${year}. Proses ini tidak mengubah tanggal sistem atau menghapus transaksi.`;
  $("#archive-year-button").classList.toggle("hidden", archived);
  $("#annual-preview").innerHTML = `<div class="annual-preview-grid">
    <div class="annual-preview-card"><span>Total pemasukan</span><strong>${formatRupiah(income)}</strong></div>
    <div class="annual-preview-card"><span>Total pengeluaran</span><strong>${formatRupiah(costs)}</strong></div>
    <div class="annual-preview-card"><span>Pendapatan bersih</span><strong>${formatRupiah(income - costs)}</strong></div>
  </div><p class="annual-hint">${transactions.length} transaksi${archived ? " tersimpan dalam arsip" : " akan dimasukkan ke arsip"}. Tahun tanggal aplikasi saat ini: ${currentYear}.</p>`;
  const list = [...data.archives].sort((a, b) => b.year - a.year);
  $("#archive-list").innerHTML = list.length ? list.map((item) =>
    `<article class="archive-item"><div><div class="archive-item-title">Laporan Rekapitulasi ${item.year}</div><div class="archive-item-meta">${item.counts.income + item.counts.expenses} transaksi · Bersih ${formatRupiah(item.totals.net)}</div></div><div class="archive-item-actions"><button class="button button-outline button-sm" data-action="view-archive" data-archive-id="${escapeHtml(item.id)}">Lihat detail</button><button class="button button-danger button-sm" data-action="delete-archive" data-archive-id="${escapeHtml(item.id)}">Hapus arsip</button></div></article>`
  ).join("") : `<div class="empty-state"><strong>Belum ada arsip tahunan</strong><p>Arsip akan tampil di sini setelah tutup buku tahunan.</p></div>`;
}

function openArchiveDetails(archive) {
  const root = $("#modal-root");
  const { income, expenses, net } = archive.totals;
  root.innerHTML = `<div class="modal-backdrop"><section class="modal archive-modal" role="dialog" aria-modal="true" aria-labelledby="archive-modal-title"><div class="modal-header"><div><h2 id="archive-modal-title">Laporan Rekapitulasi ${archive.year}</h2><p>Dibuat ${new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: "UTC" }).format(new Date(archive.createdAt))}</p></div><button class="modal-close close-btn" type="button" aria-label="Tutup">×</button></div><div class="archive-summary"><div class="archive-summary-card"><span>Total pemasukan</span><strong>${formatRupiah(income)}</strong></div><div class="archive-summary-card"><span>Total pengeluaran</span><strong>${formatRupiah(expenses)}</strong></div><div class="archive-summary-card"><span>Pendapatan bersih</span><strong>${formatRupiah(net)}</strong></div></div>${transactionTable(archive.transactions)}</section></div>`;
  const close = () => { root.innerHTML = ""; };
  $(".modal-close", root).addEventListener("click", close);
  $(".modal-backdrop", root).addEventListener("click", (event) => {
    if (event.target === event.currentTarget) close();
  });
}

function downloadArchiveReport(report) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Laporan-Rekapitulasi-${report.year}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function render() {
  const data = dataWithRelations();
  renderSidebar(data);
  renderOnboardingAction(data);
  populateFilters(data);
  $("#today-label").textContent = new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${today()}T00:00:00Z`));
  $("#dashboard-view").classList.toggle("hidden", activeView !== "dashboard");
  $("#units-view").classList.toggle("hidden", activeView !== "units");
  $("#finance-view").classList.toggle("hidden", activeView !== "finance");
  $("#annual-view").classList.toggle("hidden", activeView !== "annual");
  $("#page-title").textContent = { dashboard: "Dashboard", units: "Unit & Penyewa", finance: "Keuangan", annual: "Rekap Tahunan" }[activeView];
  $$(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.view === activeView));
  renderDashboard(data);
  renderUnits(data);
  renderFinance(data);
  renderAnnual(data);
}

function field(name, label, type = "text", options = {}) {
  const required = options.required === false ? "" : "required";
  const full = options.full ? " full" : "";
  if (type === "select") {
    return `<div class="form-field${full}"><label for="field-${name}">${label}</label><select id="field-${name}" name="${name}" ${required}>${options.options.map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`).join("")}</select></div>`;
  }
  if (type === "textarea") return `<div class="form-field${full}"><label for="field-${name}">${label}</label><textarea id="field-${name}" name="${name}" ${required} ${options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : ""}></textarea></div>`;
  return `<div class="form-field${full}"><label for="field-${name}">${label}</label><input id="field-${name}" name="${name}" type="${type}" ${required} ${options.min !== undefined ? `min="${options.min}"` : ""} ${options.step ? `step="${options.step}"` : ""} ${options.value !== undefined ? `value="${escapeHtml(options.value)}"` : ""} ${options.placeholder ? `placeholder="${escapeHtml(options.placeholder)}"` : ""}></div>`;
}

function openModal(title, subtitle, formFields, onSubmit) {
  const root = $("#modal-root");
  root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><div><h2 id="modal-title">${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div><button class="modal-close close-btn" type="button" aria-label="Tutup">×</button></div><form id="active-form"><div class="form-grid">${formFields}</div><div class="modal-actions"><button type="button" class="button button-outline modal-cancel">Batal</button><button type="submit" class="button button-primary">Simpan</button></div></form></section></div>`;
  const close = () => { root.innerHTML = ""; };
  $(".modal-close", root).addEventListener("click", close);
  $(".modal-cancel", root).addEventListener("click", close);
  $(".modal-backdrop", root).addEventListener("click", (event) => {
    if (event.target === event.currentTarget) close();
  });
  $("#active-form", root).addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      onSubmit(values);
      root.innerHTML = "";
      render();
      showToast("Data berhasil disimpan.");
    } catch (error) {
      showToast(error.message || "Data gagal disimpan.");
    }
  });
}

function openChangePasswordModal() {
  if (!authenticatedUser?.email) {
    showToast("Akun ini tidak memiliki email untuk verifikasi password.");
    return;
  }

  const root = $("#modal-root");
  root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="password-modal-title"><div class="modal-header"><div><h2 id="password-modal-title">Ganti password</h2><p>Masukkan password saat ini untuk verifikasi akun.</p></div><button class="modal-close close-btn" type="button" aria-label="Tutup">×</button></div><form id="change-password-form"><div class="form-grid">
    <div class="form-field full"><label for="current-password">Password saat ini</label><div class="auth-password-wrap"><input id="current-password" name="currentPassword" type="password" autocomplete="current-password" required><button class="password-toggle toggle-password" type="button" data-target="current-password" aria-label="Tampilkan password" aria-pressed="false">◉</button></div></div>
    <div class="form-field full"><label for="new-password">Password baru</label><div class="auth-password-wrap"><input id="new-password" name="newPassword" type="password" autocomplete="new-password" minlength="8" required><button class="password-toggle toggle-password" type="button" data-target="new-password" aria-label="Tampilkan password" aria-pressed="false">◉</button></div></div>
    <div class="form-field full"><label for="confirm-password">Konfirmasi password baru</label><div class="auth-password-wrap"><input id="confirm-password" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required><button class="password-toggle toggle-password" type="button" data-target="confirm-password" aria-label="Tampilkan password" aria-pressed="false">◉</button></div></div>
    </div><p id="change-password-error" class="form-note password-form-error" role="alert" aria-live="polite"></p><div class="modal-actions"><button type="button" class="button button-outline modal-cancel">Batal</button><button type="submit" class="button button-primary">Simpan password</button></div></form></section></div>`;

  const close = () => { root.innerHTML = ""; };
  $(".modal-close", root).addEventListener("click", close);
  $(".modal-cancel", root).addEventListener("click", close);
  $(".modal-backdrop", root).addEventListener("click", (event) => {
    if (event.target === event.currentTarget) close();
  });
  $("#change-password-form", root).addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const currentPassword = $("#current-password", form).value;
    const newPassword = $("#new-password", form).value;
    const confirmPassword = $("#confirm-password", form).value;
    const error = $("#change-password-error", root);
    const submitButton = $('button[type="submit"]', form);

    if (newPassword !== confirmPassword) {
      error.textContent = "Konfirmasi password baru tidak sama.";
      return;
    }

    submitButton.disabled = true;
    error.textContent = "";
    try {
      await authService.reauthenticate(authenticatedUser, currentPassword);
      await authService.changePassword(authenticatedUser, newPassword);
      close();
      showToast("Password berhasil diperbarui.");
    } catch (caughtError) {
      error.textContent = authErrorMessage(caughtError);
    } finally {
      submitButton.disabled = false;
    }
  });
}

function openCategoryModal() {
  openModal("Tambah kategori", "Buat kelompok untuk mengatur properti Anda.", field("name", "Nama kategori", "text", { placeholder: "Contoh: Kos Putra", full: true }), (values) => {
    workspaceController.createCategory(values);
  });
}

function openPropertyModal(categoryId) {
  const data = workspaceController.getAll();
  if (!data.categories.length) {
    openCategoryModal();
    showToast("Buat kategori terlebih dahulu.");
    return;
  }
  const categories = data.categories.map((item) => ({ value: item.id, label: item.name }));
  const select = field("categoryId", "Kategori", "select", { options: categories });
  openModal("Tambah properti", "Tambahkan properti baru ke dalam kategori.", select + field("name", "Nama properti", "text", { placeholder: "Contoh: Kos Putra 1" }), (values) => workspaceController.createProperty(values));
  if (categoryId) $("#field-categoryId").value = categoryId;
}

function openUnitModal(propertyId) {
  const data = workspaceController.getAll();
  if (!data.properties.length) {
    openPropertyModal();
    showToast("Buat properti terlebih dahulu.");
    return;
  }
  const properties = data.properties.map((item) => ({ value: item.id, label: item.name }));
  const typeOptions = ["Reguler", "Medium", "Large", "VIP"].map((item) => ({ value: item, label: item }));
  const fields = field("propertyId", "Properti", "select", { options: properties }) +
    field("unitName", "Nama unit (otomatis jika kosong)", "text", { required: false, placeholder: "Kamar 01 / Unit 1" }) +
    field("type", "Tipe unit", "select", { options: typeOptions }) +
    field("price", "Harga sewa per bulan (Rp)", "number", { min: "0", step: "1000", placeholder: "Contoh: 1200000" });
  openModal("Tambah unit", "Siapkan unit baru untuk disewakan.", fields, (values) => workspaceController.createUnit(values));
  if (propertyId) $("#field-propertyId").value = propertyId;
}

function openEditUnitModal(unitId) {
  const unit = workspaceController.getById("units", unitId);
  if (!unit) return showToast("Unit tidak ditemukan.");
  const typeOptions = [...new Set(["Reguler", "Medium", "Large", "VIP", unit.type])]
    .map((item) => ({ value: item, label: item }));
  const fields = field("unitName", "Nama unit", "text", { value: unit.unitName }) +
    field("type", "Tipe unit", "select", { options: typeOptions }) +
    field("price", "Harga sewa per bulan (Rp)", "number", { min: "0", step: "1000", value: unit.price });
  openModal("Edit unit", "Perbarui nama, tipe, atau harga sewa unit.", fields, (values) => workspaceController.updateUnit(unit.id, values));
  $("#field-type").value = unit.type;
}

function openTenantModal(unitId) {
  const data = workspaceController.getAll();
  const unit = data.units.find((item) => item.id === unitId);
  if (unitId && !unit) return showToast("Unit tidak ditemukan.");
  const availableUnits = data.units.filter((item) =>
    !data.tenants.some((tenant) => tenant.unitId === item.id)
  );
  if (!unit && !availableUnits.length) return showToast("Tidak ada unit kosong untuk penyewa baru.");
  const dueDate = today();
  const unitField = unit
    ? `<div class="form-field full"><label>Unit</label><input value="${escapeHtml(`${data.properties.find((item) => item.id === unit.propertyId)?.name ?? ""} · ${unit.unitName}`)}" disabled></div>`
    : field("unitId", "Unit kosong", "select", { options: availableUnits.map((item) => ({
      value: item.id,
      label: `${data.properties.find((property) => property.id === item.propertyId)?.name ?? ""} · ${item.unitName}`
    })) });
  const fields = unitField +
    field("name", "Nama penyewa") +
    field("whatsapp", "Nomor WhatsApp", "tel", { placeholder: "08xxxxxxxxxx" }) +
    field("startDate", "Tanggal masuk", "date", { value: dueDate }) +
    field("dueDate", "Jatuh tempo rutin", "date", { value: dueDate });
  openModal("Tambah penyewa", "Lengkapi data penyewa untuk mulai mengelola tagihan.", fields, (values) => workspaceController.createTenant({ ...values, unitId: unit?.id ?? values.unitId }));
  $("#field-startDate").value = dueDate;
  $("#field-dueDate").value = dueDate;
}

function openEditTenantModal(tenantId) {
  const tenant = workspaceController.getById("tenants", tenantId);
  if (!tenant) return showToast("Data penyewa tidak ditemukan.");
  const fields = field("name", "Nama penyewa", "text", { value: tenant.name }) +
    field("whatsapp", "Nomor WhatsApp", "tel", { value: tenant.whatsapp, placeholder: "08xxxxxxxxxx" }) +
    field("dueDate", "Tanggal jatuh tempo rutin", "date", { value: tenant.dueDate }) +
    field("specialTerms", "Harga / ketentuan khusus", "textarea", {
      required: false,
      full: true,
      placeholder: "Catatan tarif atau kesepakatan khusus (opsional)"
    });
  openModal("Edit penyewa", "Koreksi data penyewa dan jatuh tempo. Catatan khusus tidak mengubah tarif tagihan; riwayat pembayaran tetap disimpan.", fields, (values) => workspaceController.updateTenant(tenant.id, values));
  $("#field-specialTerms").value = tenant.specialTerms ?? "";
}

function openExpenseModal() {
  const data = workspaceController.getAll();
  const fields = field("scope", "Cakupan pengeluaran", "select", { options: [
    { value: "unit", label: "Unit tertentu" },
    { value: "property", label: "Tingkat properti" },
    { value: "global", label: "Global / bisnis" }
  ] }) +
  field("propertyId", "Properti", "select", { required: data.properties.length > 0, options: data.properties.map((item) => ({ value: item.id, label: item.name })) }) +
  field("unitId", "Unit (untuk biaya unit)", "select", { required: false, options: data.units.map((item) => ({ value: item.id, label: `${data.properties.find((property) => property.id === item.propertyId)?.name ?? ""} · ${item.unitName}` })) }) +
  field("category", "Kategori biaya", "text", { placeholder: "Contoh: Perbaikan" }) +
  field("amount", "Nominal (Rp)", "number", { min: "0", step: "1000", placeholder: "Contoh: 300000" }) +
  field("date", "Tanggal", "date", { value: today() }) +
  field("description", "Deskripsi", "textarea", { full: true, placeholder: "Jelaskan pengeluaran..." });
  openModal("Catat pengeluaran", "Tentukan ruang lingkup biaya agar laporan tetap akurat.", fields, (values) => workspaceController.createExpense(values));
  $("#field-date").value = today();
  const updateScope = () => {
    const global = $("#field-scope").value === "global";
    const unitScope = $("#field-scope").value === "unit";
    $("#field-propertyId").disabled = global;
    $("#field-unitId").disabled = !unitScope;
    $("#field-unitId").required = unitScope;
  };
  $("#field-scope").addEventListener("change", updateScope);
  updateScope();
}

function handleWhatsApp(tenantId) {
  const data = dataWithRelations();
  const tenant = data.tenants.find((item) => item.id === tenantId);
  const unit = tenant ? data.unitById.get(tenant.unitId) : null;
  const property = unit ? data.propertyById.get(unit.propertyId) : null;
  if (!tenant || !unit || !property) return showToast("Data penyewa atau unit tidak ditemukan.");
  const status = getBillingStatus(tenant, data.payments.filter(isPaymentActive));
  try {
    const url = getWhatsAppUrl(tenant.whatsapp, getBillingMessage(tenant, unit, property, status));
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (error) {
    showToast(error.message);
  }
}

async function handleAction(button) {
  const action = button.dataset.action;
  if (action === "add-category") {
    openCategoryModal();
  } else if (action === "delete-category") {
    const data = workspaceController.getAll();
    const category = data.categories.find((item) => item.id === button.dataset.categoryId);
    if (category && await showConfirm({
      title: "Hapus kategori?",
      message: `Hapus kategori "${category.name}" beserta seluruh properti, unit, penyewa, dan transaksi di dalamnya?`,
      subtext: "Tindakan ini tidak dapat dibatalkan.",
      actionLabel: "Ya, Hapus"
    })) {
      try {
        workspaceController.deleteCategory(category.id);
        activePropertyId = "all";
        render();
        showToast("Kategori dan seluruh data turunannya berhasil dihapus.");
      } catch (error) {
        showToast(error.message || "Kategori gagal dihapus.");
      }
    }
  } else if (action === "add-property") {
    openPropertyModal(button.dataset.categoryId);
  } else if (action === "delete-property") {
    const property = workspaceController.getAll().properties.find((item) => item.id === button.dataset.propertyId);
    if (property && await showConfirm({
      title: "Hapus properti?",
      message: `Hapus properti "${property.name}" beserta seluruh unit, penyewa, dan transaksinya?`,
      subtext: "Tindakan ini tidak dapat dibatalkan.",
      actionLabel: "Ya, Hapus"
    })) {
      try {
        workspaceController.deleteProperty(property.id);
        if (activePropertyId === property.id) activePropertyId = "all";
        render();
        showToast("Properti dan seluruh data turunannya berhasil dihapus.");
      } catch (error) {
        showToast(error.message || "Properti gagal dihapus.");
      }
    }
  } else if (action === "add-unit") {
    openUnitModal(button.dataset.propertyId || (activePropertyId !== "all" ? activePropertyId : ""));
  } else if (action === "add-tenant") {
    openTenantModal(button.dataset.unitId);
  } else if (action === "edit-unit") {
    openEditUnitModal(button.dataset.unitId);
  } else if (action === "edit-tenant") {
    openEditTenantModal(button.dataset.tenantId);
  } else if (action === "add-expense") {
    openExpenseModal();
  } else if (action === "whatsapp") {
    handleWhatsApp(button.dataset.tenantId);
  } else if (action === "mark-paid") {
    try {
      workspaceController.markPaymentPaid(button.dataset.tenantId, button.dataset.dueDate);
      render();
      showToast("Pembayaran ditandai lunas dan pemasukan dicatat.");
    } catch (error) {
      showToast(error.message);
    }
  } else if (action === "cancel-payment") {
    const payment = workspaceController.getById("payments", button.dataset.paymentId);
    if (payment && isPaymentActive(payment) && await showConfirm({
      title: "Batalkan pembayaran?",
      message: `Batalkan pembayaran "${payment.description}" sebesar ${formatRupiah(payment.amount)}?`,
      subtext: "Pembayaran akan ditandai dibatalkan dan tidak lagi dihitung sebagai pemasukan.",
      actionLabel: "Ya, Batalkan"
    })) {
      try {
        workspaceController.cancelPayment(payment.id);
        render();
        showToast("Pembayaran dibatalkan. Unit dan penyewa tetap aktif.");
      } catch (error) {
        showToast(error.message || "Pembayaran gagal dibatalkan.");
      }
    }
  } else if (action === "remove-tenant") {
    const tenant = workspaceController.getAll().tenants.find((item) => item.id === button.dataset.tenantId);
    if (tenant && await showConfirm({
      title: "Checkout penyewa?",
      message: `Checkout ${tenant.name}?`,
      subtext: "Riwayat transaksi tetap disimpan.",
      actionLabel: "Ya, Checkout"
    })) {
      try {
        workspaceController.removeTenant(tenant.id);
        render();
        showToast("Penyewa checkout. Riwayat pembayaran tetap tersimpan.");
      } catch (error) {
        showToast(error.message);
      }
    }
  } else if (action === "delete-unit") {
    const unit = workspaceController.getAll().units.find((item) => item.id === button.dataset.unitId);
    if (unit && await showConfirm({
      title: "Hapus unit?",
      message: "Apakah Anda yakin ingin menghapus Unit/Kamar ini?",
      subtext: "Data penyewa akan dibersihkan, sementara riwayat keuangan dipertahankan.",
      actionLabel: "Ya, Hapus"
    })) {
      try {
        workspaceController.deleteUnit(unit.id);
        render();
        showToast("Unit berhasil dihapus. Data penyewa dibersihkan dan riwayat keuangan dipertahankan.");
      } catch (error) {
        showToast(error.message);
      }
    }
  } else if (action === "archive-year") {
    const year = Number($("#annual-year").value);
    try {
      const report = workspaceController.archiveAnnualReport(year);
      downloadArchiveReport(report);
      render();
      await showAlert({
        title: "Laporan berhasil diarsipkan",
        message: `Laporan tahun ${year} berhasil diarsipkan dan diunduh sebagai JSON.`,
        subtext: `Tanggal aplikasi tetap mengikuti ${workspaceController.getAll().dateMode === "custom" ? "tanggal kustom yang dipilih" : "kalender perangkat"}. Riwayat transaksi tidak dihapus.`
      });
    } catch (error) {
      showToast(error.message || "Rekap tahunan gagal dibuat.");
    }
  } else if (action === "view-archive") {
    const archive = workspaceController.getAll().archives.find((item) => item.id === button.dataset.archiveId);
    if (archive) openArchiveDetails(archive);
  } else if (action === "delete-archive") {
    const archive = workspaceController.getAll().archives.find((item) => item.id === button.dataset.archiveId);
    if (archive && await showConfirm({
      title: "Hapus arsip?",
      message: `Hapus arsip Laporan Rekapitulasi ${archive.year}?`,
      subtext: "Tindakan ini tidak dapat dibatalkan.",
      actionLabel: "Ya, Hapus"
    })) {
      try {
        workspaceController.deleteArchiveReport(archive.id);
        render();
        showToast(`Arsip tahun ${archive.year} dihapus.`);
      } catch (error) {
        showToast(error.message || "Arsip gagal dihapus.");
      }
    }
  } else if (action === "reset-date") {
    try {
      workspaceController.resetDateMode();
      render();
      showToast("Tanggal aplikasi kembali mengikuti tanggal perangkat.");
    } catch (error) {
      showToast(error.message || "Tanggal perangkat gagal dipulihkan.");
    }
  }
}

document.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  const viewButton = event.target.closest("[data-view]");
  const propertyButton = event.target.closest("[data-property]");
  if (event.target.closest(".sidebar [data-view], .sidebar [data-property], .sidebar [data-action]")) {
    setMobileSidebarOpen(false);
  }
  if (actionButton) {
    void handleAction(actionButton).catch((error) => {
      console.error("Aksi dashboard gagal.", error);
      showToast(error.message || "Aksi gagal dilakukan.");
    });
  }
  else if (viewButton) {
    activeView = viewButton.dataset.view;
    render();
  } else if (propertyButton) {
    activePropertyId = propertyButton.dataset.property;
    activeView = "units";
    render();
  }
});

$("#mobile-menu-btn").addEventListener("click", () => {
  setMobileSidebarOpen(!document.body.classList.contains("sidebar-open"));
});
$("#sidebar-overlay").addEventListener("click", () => setMobileSidebarOpen(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("sidebar-open")) {
    setMobileSidebarOpen(false);
  }
});
window.addEventListener("resize", () => {
  if (window.innerWidth >= 992 && document.body.classList.contains("sidebar-open")) {
    setMobileSidebarOpen(false);
  }
});

$("#dashboard-filter").addEventListener("change", (event) => {
  activePropertyId = event.target.value;
  render();
});
$("#unit-filter").addEventListener("change", (event) => {
  activePropertyId = event.target.value;
  render();
});
$("#finance-filter").addEventListener("change", render);
$("#finance-period").addEventListener("change", render);
$("#annual-year").addEventListener("change", (event) => {
  annualYear = Number(event.target.value);
  render();
});
$("#date-mode").addEventListener("change", (event) => {
  try {
    if (event.target.value === "custom") {
      const currentDate = getCurrentAppDate();
      $("#app-date-picker").value = currentDate;
      workspaceController.setDateMode("custom", currentDate);
    } else {
      workspaceController.resetDateMode();
    }
    render();
  } catch (error) {
    showToast(error.message || "Mode tanggal gagal diperbarui.");
    render();
  }
});
$("#app-date-picker").addEventListener("change", (event) => {
  try {
    workspaceController.setDateMode("custom", event.target.value);
    render();
    showToast(`Tanggal aplikasi diatur ke ${dateLabel(event.target.value)}.`);
  } catch (error) {
    showToast(error.message || "Tanggal kustom tidak valid.");
    render();
  }
});

$$("[data-auth-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    setAuthTab(tab.dataset.authTab);
    setAuthStatus("");
  });
});

$("#forgot-password-link").addEventListener("click", (event) => {
  event.preventDefault();
  const email = $("#input-login-email").value.trim();
  if (!email) {
    $("#input-login-email").reportValidity();
    return;
  }
  setAuthStatus("Mengirim tautan reset password...");
  authService.sendPasswordReset(email)
    .then(() => setAuthStatus("Tautan reset password berhasil dikirim jika email terdaftar."))
    .catch((error) => setAuthStatus(authErrorMessage(error)));
});
$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setAuthStatus("Memproses login...", { busy: true });
  try {
    await authService.signIn(
      $("#input-login-email").value.trim(),
      $("#input-login-password").value,
      $("#remember-me").checked
    );
  } catch (error) {
    setAuthStatus(authErrorMessage(error));
  }
});
$("#register-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = $("#input-register-password");
  const confirmation = $("#input-register-confirm-password");
  if (password.value !== confirmation.value) {
    confirmation.setCustomValidity("Konfirmasi password belum sama.");
    confirmation.reportValidity();
    return;
  }
  confirmation.setCustomValidity("");
  setAuthStatus("Membuat akun...", { busy: true });
  try {
    const credential = await authService.createAccount(
      $("#input-register-email").value.trim(),
      password.value
    );
    await authService.updateProfile(credential.user, { displayName: $("#input-register-name").value.trim() });
  } catch (error) {
    setAuthStatus(authErrorMessage(error));
  }
});
$("#input-register-confirm-password").addEventListener("input", (event) => {
  event.currentTarget.setCustomValidity("");
});
$("#auth-retry-button").addEventListener("click", () => {
  if (authService.currentUser) dashboardController.initializeAuthenticatedSession(authService.currentUser);
});
$("#change-password-button").addEventListener("click", openChangePasswordModal);
$("#logout-button").addEventListener("click", async () => {
  if (!authenticatedUser) return;
  try {
    await flushUserWrites(authenticatedUser.uid);
  } catch (error) {
    console.error("Sinkronisasi akhir sebelum keluar gagal.", error);
    showToast(`Sebagian data mungkin belum tersinkron. ${authErrorMessage(error)}`);
  }
  try {
    await authService.signOut();
  } catch (error) {
    showToast(authErrorMessage(error));
  }
});

dashboardController.observeAuthentication();

window.setInterval(() => {
  if (authenticatedUser && workspaceController.getAll().dateMode === "device") render();
}, 60_000);