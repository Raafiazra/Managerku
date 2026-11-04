const STORAGE_KEY = "kos-management-app-v1";
let activeStorageKey = STORAGE_KEY;
let cloudSync = null;

const makeId = () => globalThis.crypto?.randomUUID?.() ??
  `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const isPaymentActive = (payment) => payment.status !== "CANCELLED";

function deviceDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function dateFromSettings(settings) {
  return settings?.dateMode === "custom" && isValidDateString(settings.customDate)
    ? settings.customDate
    : deviceDateString();
}

export function getCurrentAppDate() {
  const raw = localStorage.getItem(activeStorageKey);
  if (!raw) return deviceDateString();
  return dateFromSettings(JSON.parse(raw));
}

const emptyData = () => ({
  categories: [],
  properties: [],
  units: [],
  tenants: [],
  expenses: [],
  payments: [],
  archives: [],
  dateMode: "device",
  customDate: null,
  activeYear: new Date().getFullYear()
});

function readData() {
  try {
    const raw = localStorage.getItem(activeStorageKey);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw);
    const initial = emptyData();
    const data = Object.fromEntries(Object.keys(initial).map((key) => [
      key,
      Array.isArray(initial[key])
        ? (Array.isArray(parsed[key]) ? parsed[key] : [])
        : key === "dateMode"
          ? (parsed.dateMode === "custom" && isValidDateString(parsed.customDate) ? "custom" : "device")
          : key === "customDate"
            ? (isValidDateString(parsed.customDate) ? parsed.customDate : null)
            : (Number.isInteger(parsed[key]) ? parsed[key] : initial[key])
    ]));
    data.activeYear = Number(dateFromSettings(data).slice(0, 4));
    return data;
  } catch (error) {
    console.error("Tidak dapat membaca database lokal Managerku.", error);
    throw new Error("Data lokal tidak dapat dibaca. Periksa penyimpanan browser Anda.");
  }
}

function writeData(data, syncToCloud = true) {
  try {
    localStorage.setItem(activeStorageKey, JSON.stringify(data));
  } catch (error) {
    console.error("Tidak dapat menyimpan database lokal Managerku.", error);
    throw new Error("Data gagal disimpan. Ruang penyimpanan browser mungkin penuh.");
  }
  if (syncToCloud && cloudSync) {
    const { uid, save, onError } = cloudSync;
    Promise.resolve()
      .then(() => save(uid, structuredClone(data)))
      .catch((error) => {
        console.error("Sinkronisasi Firestore Managerku gagal.", error);
        onError(error);
      });
  }
}

export function setUserStorageScope(uid = null) {
  cloudSync = null;
  activeStorageKey = uid ? `${STORAGE_KEY}:user:${uid}` : STORAGE_KEY;
}

export function getLegacyData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw);
    const initial = emptyData();
    const data = Object.fromEntries(Object.keys(initial).map((key) => [
      key,
      Array.isArray(initial[key])
        ? (Array.isArray(parsed[key]) ? parsed[key] : [])
        : key === "dateMode"
          ? (parsed.dateMode === "custom" && isValidDateString(parsed.customDate) ? "custom" : "device")
          : key === "customDate"
            ? (isValidDateString(parsed.customDate) ? parsed.customDate : null)
            : (Number.isInteger(parsed[key]) ? parsed[key] : initial[key])
    ]));
    data.activeYear = Number(dateFromSettings(data).slice(0, 4));
    return data;
  } catch (error) {
    console.error("Tidak dapat membaca database lokal lama Managerku.", error);
    throw new Error("Data lokal lama tidak dapat dibaca. Periksa penyimpanan browser Anda.");
  }
}

export function setCloudSync(uid, save, onError) {
  if (!uid || typeof save !== "function" || typeof onError !== "function") {
    throw new Error("Konfigurasi sinkronisasi Firestore tidak valid.");
  }
  cloudSync = { uid, save, onError };
}

function validateText(value, label) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${label} wajib diisi.`);
  return result;
}

function validateAmount(value, label = "Nominal") {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`${label} harus berupa angka nol atau lebih.`);
  return amount;
}

function validateDate(value, label) {
  if (!isValidDateString(value)) throw new Error(`${label} harus berupa tanggal yang valid.`);
  return value;
}

export const db = {
  replaceAll(data) {
    const initial = emptyData();
    const safeData = Object.fromEntries(Object.keys(initial).map((key) => [
      key,
      Array.isArray(initial[key])
        ? (Array.isArray(data?.[key]) ? data[key] : [])
        : key === "dateMode"
          ? (data?.dateMode === "custom" && isValidDateString(data.customDate) ? "custom" : "device")
          : key === "customDate"
            ? (isValidDateString(data?.customDate) ? data.customDate : null)
            : (Number.isInteger(data?.[key]) ? data[key] : initial[key])
    ]));
    safeData.activeYear = Number(dateFromSettings(safeData).slice(0, 4));
    writeData(safeData, false);
  },
  getAll() {
    return readData();
  },
  getActiveYear() {
    return Number(getCurrentAppDate().slice(0, 4));
  },
  setDateMode(mode, customDate = null) {
    if (mode !== "device" && mode !== "custom") throw new Error("Mode tanggal tidak valid.");
    const data = readData();
    if (mode === "custom" && !isValidDateString(customDate)) throw new Error("Pilih tanggal kustom yang valid.");
    data.dateMode = mode;
    data.customDate = mode === "custom" ? customDate : null;
    data.activeYear = Number(dateFromSettings(data).slice(0, 4));
    writeData(data);
  },
  resetDateMode() {
    db.setDateMode("device");
  },
  getById(collection, id) {
    const data = readData();
    return data[collection]?.find((item) => item.id === id) ?? null;
  },
  createCategory(input) {
    const data = readData();
    const record = { id: makeId(), name: validateText(input.name, "Nama kategori") };
    data.categories.push(record);
    writeData(data);
    return record;
  },
  deleteCategory(categoryId) {
    const data = readData();
    if (!data.categories.some((category) => category.id === categoryId)) throw new Error("Kategori tidak ditemukan.");
    const propertyIds = new Set(data.properties.filter((property) => property.categoryId === categoryId).map((property) => property.id));
    const unitIds = new Set(data.units.filter((unit) => propertyIds.has(unit.propertyId)).map((unit) => unit.id));
    const tenantIds = new Set(data.tenants.filter((tenant) => unitIds.has(tenant.unitId)).map((tenant) => tenant.id));
    data.tenants = data.tenants.filter((tenant) => !tenantIds.has(tenant.id));
    data.units = data.units.filter((unit) => !unitIds.has(unit.id));
    data.properties = data.properties.filter((property) => !propertyIds.has(property.id));
    data.payments = data.payments.filter((payment) => !propertyIds.has(payment.propertyId) && !unitIds.has(payment.unitId) && !tenantIds.has(payment.tenantId));
    data.expenses = data.expenses.filter((expense) => !propertyIds.has(expense.propertyId) && !unitIds.has(expense.unitId));
    data.categories = data.categories.filter((category) => category.id !== categoryId);
    writeData(data);
  },
  createProperty(input) {
    const data = readData();
    if (!data.categories.some((item) => item.id === input.categoryId)) throw new Error("Pilih kategori yang valid.");
    const record = { id: makeId(), categoryId: input.categoryId, name: validateText(input.name, "Nama properti") };
    data.properties.push(record);
    writeData(data);
    return record;
  },
  deleteProperty(propertyId) {
    const data = readData();
    if (!data.properties.some((property) => property.id === propertyId)) throw new Error("Properti tidak ditemukan.");
    const unitIds = new Set(data.units.filter((unit) => unit.propertyId === propertyId).map((unit) => unit.id));
    const tenantIds = new Set(data.tenants.filter((tenant) => unitIds.has(tenant.unitId)).map((tenant) => tenant.id));
    data.tenants = data.tenants.filter((tenant) => !tenantIds.has(tenant.id));
    data.units = data.units.filter((unit) => !unitIds.has(unit.id));
    data.payments = data.payments.filter((payment) => payment.propertyId !== propertyId && !unitIds.has(payment.unitId) && !tenantIds.has(payment.tenantId));
    data.expenses = data.expenses.filter((expense) => expense.propertyId !== propertyId && !unitIds.has(expense.unitId));
    data.properties = data.properties.filter((property) => property.id !== propertyId);
    writeData(data);
  },
  createUnit(input) {
    const data = readData();
    if (!data.properties.some((item) => item.id === input.propertyId)) throw new Error("Pilih properti yang valid.");
    const unitName = String(input.unitName ?? "").trim() || this.nextUnitName(input.propertyId);
    if (data.units.some((item) => item.propertyId === input.propertyId && item.unitName.toLowerCase() === unitName.toLowerCase())) {
      throw new Error("Nama unit sudah digunakan pada properti ini.");
    }
    const record = {
      id: makeId(),
      propertyId: input.propertyId,
      unitName,
      type: ["Reguler", "Medium", "Large", "VIP"].includes(input.type) ? input.type : "Reguler",
      price: validateAmount(input.price, "Harga sewa"),
      status: "VACANT"
    };
    writeData({ ...data, units: [...data.units, record] });
    return record;
  },
  updateUnit(unitId, input) {
    const data = readData();
    const unit = data.units.find((item) => item.id === unitId);
    if (!unit) throw new Error("Unit tidak ditemukan.");
    const unitName = validateText(input.unitName, "Nama unit");
    if (data.units.some((item) =>
      item.id !== unitId && item.propertyId === unit.propertyId &&
      item.unitName.toLowerCase() === unitName.toLowerCase()
    )) {
      throw new Error("Nama unit sudah digunakan pada properti ini.");
    }
    unit.unitName = unitName;
    unit.type = validateText(input.type, "Tipe unit");
    unit.price = validateAmount(input.price, "Harga sewa");
    writeData(data);
    return unit;
  },
  nextUnitName(propertyId) {
    const data = readData();
    const units = data.units.filter((unit) => unit.propertyId === propertyId);
    const numericNames = units.map((unit) => Number(unit.unitName.match(/(\d+)$/)?.[1])).filter(Number.isFinite);
    const next = Math.max(0, ...numericNames) + 1;
    const propertyName = data.properties.find((item) => item.id === propertyId)?.name ?? "";
    const prefix = /bedakan|kontrakan/i.test(propertyName) ? "Unit " : "Kamar ";
    return `${prefix}${prefix === "Unit " ? next : String(next).padStart(2, "0")}`;
  },
  createTenant(input) {
    const data = readData();
    const unit = data.units.find((item) => item.id === input.unitId);
    if (!unit) throw new Error("Unit tidak ditemukan.");
    if (data.tenants.some((item) => item.unitId === input.unitId)) throw new Error("Unit ini masih memiliki penyewa aktif.");
    if (!input.startDate || !input.dueDate) throw new Error("Tanggal masuk dan jatuh tempo wajib diisi.");
    const record = {
      id: makeId(),
      unitId: input.unitId,
      name: validateText(input.name, "Nama penyewa"),
      whatsapp: validateText(input.whatsapp, "Nomor WhatsApp"),
      startDate: input.startDate,
      dueDate: input.dueDate
    };
    unit.status = "OCCUPIED";
    data.tenants.push(record);
    writeData(data);
    return record;
  },
  updateTenant(tenantId, input) {
    const data = readData();
    const tenant = data.tenants.find((item) => item.id === tenantId);
    if (!tenant) throw new Error("Data penyewa tidak ditemukan.");
    tenant.name = validateText(input.name, "Nama penyewa");
    tenant.whatsapp = validateText(input.whatsapp, "Nomor WhatsApp");
    tenant.dueDate = validateDate(input.dueDate, "Tanggal jatuh tempo");
    tenant.specialTerms = String(input.specialTerms ?? "").trim();
    writeData(data);
    return tenant;
  },
  markPaymentPaid(tenantId, dueDate) {
    const data = readData();
    const tenant = data.tenants.find((item) => item.id === tenantId);
    if (!tenant) throw new Error("Data penyewa tidak ditemukan.");
    const unit = data.units.find((item) => item.id === tenant.unitId);
    if (!unit) throw new Error("Unit penyewa tidak ditemukan.");
    const existing = data.payments.find((item) =>
      isPaymentActive(item) && item.tenantId === tenantId && item.dueDate?.slice(0, 7) === dueDate.slice(0, 7)
    );
    if (existing) return existing;
    const payment = {
      id: makeId(),
      tenantId,
      unitId: unit.id,
      propertyId: unit.propertyId,
      dueDate,
      amount: unit.price,
      date: getCurrentAppDate(),
      description: `Sewa ${unit.unitName} - ${tenant.name}`
    };
    data.payments.push(payment);
    writeData(data);
    return payment;
  },
  cancelPayment(paymentId) {
    const data = readData();
    const payment = data.payments.find((item) => item.id === paymentId);
    if (!payment) throw new Error("Transaksi pembayaran tidak ditemukan.");
    if (!isPaymentActive(payment)) throw new Error("Transaksi pembayaran ini sudah dibatalkan.");

    const paymentYear = Number(payment.date?.slice(0, 4));
    if (data.archives.some((archive) =>
      archive.year === paymentYear && Array.isArray(archive.transactions) &&
      archive.transactions.some((transaction) => transaction.id === paymentId)
    )) {
      throw new Error("Pembayaran ini sudah masuk arsip tahunan dan tidak dapat dibatalkan.");
    }

    const cancelledPayment = {
      ...payment,
      status: "CANCELLED",
      cancelledAt: new Date().toISOString(),
      cancellationNote: "Dibatalkan oleh pengelola"
    };
    data.payments = data.payments.map((item) => item.id === paymentId ? cancelledPayment : item);
    writeData(data);
    return cancelledPayment;
  },
  createExpense(input) {
    const data = readData();
    if (!["global", "property", "unit"].includes(input.scope)) throw new Error("Pilih cakupan pengeluaran yang valid.");
    if (input.scope !== "global" && !data.properties.some((item) => item.id === input.propertyId)) {
      throw new Error("Pilih properti yang valid.");
    }
    if (input.scope === "unit" && !data.units.some((item) => item.id === input.unitId && item.propertyId === input.propertyId)) {
      throw new Error("Pilih unit yang valid.");
    }
    if (!input.date) throw new Error("Tanggal pengeluaran wajib diisi.");
    const record = {
      id: makeId(),
      propertyId: input.scope === "global" ? null : input.propertyId,
      unitId: input.scope === "unit" ? input.unitId : null,
      scope: input.scope,
      category: validateText(input.category, "Kategori pengeluaran"),
      amount: validateAmount(input.amount),
      description: validateText(input.description, "Deskripsi"),
      date: input.date
    };
    data.expenses.push(record);
    writeData(data);
    return record;
  },
  removeTenant(tenantId) {
    const data = readData();
    const tenant = data.tenants.find((item) => item.id === tenantId);
    if (!tenant) throw new Error("Data penyewa tidak ditemukan.");
    data.payments = data.payments.map((payment) =>
      payment.tenantId === tenantId ? { ...payment, tenantId: null } : payment
    );
    data.tenants = data.tenants.filter((item) => item.id !== tenantId);
    const unit = data.units.find((item) => item.id === tenant.unitId);
    if (unit) unit.status = "VACANT";
    writeData(data);
  },
  deleteUnit(unitId) {
    const data = readData();
    const unit = data.units.find((item) => item.id === unitId);
    if (!unit) throw new Error("Unit tidak ditemukan.");

    const tenantIds = new Set(data.tenants.filter((tenant) => tenant.unitId === unitId).map((tenant) => tenant.id));
    data.tenants = data.tenants.filter((tenant) => tenant.unitId !== unitId);
    data.payments = data.payments.map((payment) =>
      payment.unitId === unitId || tenantIds.has(payment.tenantId)
        ? { ...payment, tenantId: null, unitId: null, unitName: unit.unitName }
        : payment
    );
    data.expenses = data.expenses.map((expense) =>
      expense.unitId === unitId
        ? { ...expense, unitId: null, unitName: unit.unitName }
        : expense
    );
    data.units = data.units.filter((item) => item.id !== unitId);
    writeData(data);
  },
  archiveAnnualReport(year) {
    const data = readData();
    const reportYear = Number(year);
    if (!Number.isInteger(reportYear) || reportYear < 2000 || reportYear > 9999) throw new Error("Tahun laporan tidak valid.");
    if (data.archives.some((archive) => archive.year === reportYear)) throw new Error(`Laporan tahun ${reportYear} sudah diarsipkan.`);

    const properties = new Map(data.properties.map((property) => [property.id, property]));
    const categories = new Map(data.categories.map((category) => [category.id, category]));
    const units = new Map(data.units.map((unit) => [unit.id, unit]));
    const tenants = new Map(data.tenants.map((tenant) => [tenant.id, tenant]));
    const payments = data.payments.filter((payment) =>
      isPaymentActive(payment) && payment.date?.startsWith(`${reportYear}-`)
    );
    const expenses = data.expenses.filter((expense) => expense.date?.startsWith(`${reportYear}-`));
    const transactions = [
      ...payments.map((payment) => {
        const unit = units.get(payment.unitId);
        const tenant = tenants.get(payment.tenantId);
        const property = properties.get(payment.propertyId) ?? (unit ? properties.get(unit.propertyId) : null);
        const category = property ? categories.get(property.categoryId) : null;
        return {
          id: payment.id,
          type: "income",
          date: payment.date,
          amount: payment.amount,
          description: payment.description,
          propertyId: payment.propertyId ?? unit?.propertyId ?? null,
          propertyName: property?.name ?? payment.propertyName ?? "Properti dihapus",
          categoryName: category?.name ?? payment.categoryName ?? "Tanpa kategori",
          unitName: unit?.unitName ?? payment.unitName ?? null,
          tenantName: tenant?.name ?? payment.tenantName ?? null
        };
      }),
      ...expenses.map((expense) => {
        const unit = units.get(expense.unitId);
        const property = properties.get(expense.propertyId) ?? (unit ? properties.get(unit.propertyId) : null);
        const category = property ? categories.get(property.categoryId) : null;
        return {
          id: expense.id,
          type: "expense",
          date: expense.date,
          amount: expense.amount,
          description: expense.description,
          scope: expense.scope,
          expenseCategory: expense.category,
          propertyId: expense.propertyId ?? unit?.propertyId ?? null,
          propertyName: property?.name ?? expense.propertyName ?? (expense.scope === "global" ? "Global" : "Properti dihapus"),
          categoryName: category?.name ?? expense.categoryName ?? "Tanpa kategori",
          unitName: unit?.unitName ?? expense.unitName ?? null
        };
      })
    ].sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
    const income = payments.reduce((total, payment) => total + payment.amount, 0);
    const expenseTotal = expenses.reduce((total, expense) => total + expense.amount, 0);
    const report = {
      id: makeId(),
      year: reportYear,
      createdAt: new Date().toISOString(),
      totals: { income, expenses: expenseTotal, net: income - expenseTotal },
      counts: { income: payments.length, expenses: expenses.length },
      transactions
    };
    data.archives.push(report);
    writeData(data);
    return report;
  },
  deleteArchiveReport(reportId) {
    const data = readData();
    if (!data.archives.some((archive) => archive.id === reportId)) throw new Error("Arsip laporan tidak ditemukan.");
    data.archives = data.archives.filter((archive) => archive.id !== reportId);
    writeData(data);
  },
};