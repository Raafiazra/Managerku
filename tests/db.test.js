import test from "node:test";
import assert from "node:assert/strict";
import { db, isPaymentActive, LocalDatabaseService, setUserStorageScope } from "../Assets/js/db.js";

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

function createOccupiedUnit() {
  globalThis.localStorage = new MemoryStorage();
  setUserStorageScope(null);
  const category = db.createCategory({ name: "Kos Putra" });
  const property = db.createProperty({ categoryId: category.id, name: "Kos Melati" });
  const unit = db.createUnit({
    propertyId: property.id,
    unitName: "Kamar 01",
    type: "Reguler",
    price: 500000
  });
  const tenant = db.createTenant({
    unitId: unit.id,
    name: "Taufik",
    whatsapp: "081234567890",
    startDate: "2026-01-01",
    dueDate: "2026-01-10"
  });
  return { unit, tenant };
}

test("LocalDatabaseService instances isolate storage and user scopes", () => {
  const first = new LocalDatabaseService(new MemoryStorage());
  const second = new LocalDatabaseService(new MemoryStorage());

  first.setUserStorageScope("first-user");
  first.createCategory({ name: "Properti pertama" });

  assert.equal(first.getAll().categories.length, 1);
  assert.equal(second.getAll().categories.length, 0);

  first.setUserStorageScope("second-user");
  assert.equal(first.getAll().categories.length, 0);
});

test("unit edits update valid details and reject duplicate names", () => {
  const { unit } = createOccupiedUnit();
  const secondUnit = db.createUnit({
    propertyId: unit.propertyId,
    unitName: "Kamar 02",
    type: "Large",
    price: 750000
  });

  db.updateUnit(unit.id, { unitName: "Kamar 01 Lt. 1", type: "VIP", price: "900000" });
  assert.deepEqual(
    (({ unitName, type, price }) => ({ unitName, type, price }))(db.getById("units", unit.id)),
    { unitName: "Kamar 01 Lt. 1", type: "VIP", price: 900000 }
  );
  assert.throws(() => db.updateUnit(unit.id, {
    unitName: secondUnit.unitName,
    type: "VIP",
    price: 900000
  }), /Nama unit sudah digunakan/);
});

test("units store and update facilities as normalized lists", () => {
  const { unit } = createOccupiedUnit();
  db.updateUnit(unit.id, {
    unitName: unit.unitName,
    type: unit.type,
    price: unit.price,
    facilities: "AC, WiFi, AC"
  });
  assert.deepEqual(db.getById("units", unit.id).facilities, ["AC", "WiFi"]);
});

test("tenant edits preserve payment history and validate due dates", () => {
  const { tenant } = createOccupiedUnit();
  const payment = db.markPaymentPaid(tenant.id, tenant.dueDate);

  db.updateTenant(tenant.id, {
    name: "Taufik / Verania",
    whatsapp: "081111111111",
    dueDate: "2026-01-15",
    specialTerms: "Diskon khusus"
  });

  assert.equal(db.getById("tenants", tenant.id).name, "Taufik / Verania");
  assert.equal(db.getById("tenants", tenant.id).whatsapp, "081111111111");
  assert.equal(db.getById("tenants", tenant.id).dueDate, "2026-01-15");
  assert.equal(db.getById("tenants", tenant.id).specialTerms, "Diskon khusus");
  assert.equal(db.getById("payments", payment.id).dueDate, "2026-01-10");
  assert.throws(() => db.updateTenant(tenant.id, {
    name: "Taufik",
    whatsapp: "081111111111",
    dueDate: "2026-02-30"
  }), /tanggal yang valid/);
});

test("editing unit price does not mutate prior payments", () => {
  const { unit, tenant } = createOccupiedUnit();
  const payment = db.markPaymentPaid(tenant.id, tenant.dueDate);

  db.updateUnit(unit.id, { unitName: unit.unitName, type: unit.type, price: 700000 });

  assert.equal(db.getById("units", unit.id).price, 700000);
  assert.equal(db.getById("payments", payment.id).amount, 500000);
});

test("canceling an unpaid rental frees the unit without changing financial records", () => {
  const { unit, tenant } = createOccupiedUnit();
  const paymentsBefore = db.getAll().payments;
  const expensesBefore = db.getAll().expenses;

  db.cancelRental(tenant.id);

  assert.equal(db.getById("tenants", tenant.id), null);
  assert.equal(db.getById("units", unit.id).status, "VACANT");
  assert.deepEqual(db.getAll().payments, paymentsBefore);
  assert.deepEqual(db.getAll().expenses, expensesBefore);
  assert.equal(db.getAll().invoices.find((invoice) => invoice.tenantId === tenant.id).status, "CANCELLED");
});

test("canceling a rental with payment history is rejected without changing data", () => {
  const { unit, tenant } = createOccupiedUnit();
  db.markPaymentPaid(tenant.id, tenant.dueDate);
  const before = db.getAll();

  assert.throws(() => db.cancelRental(tenant.id), /Gunakan Checkout/);
  assert.deepEqual(db.getAll(), before);
  assert.equal(db.getById("units", unit.id).status, "OCCUPIED");
});

test("refund records expense, preserves income, cancels tenant, and frees the unit", () => {
  const { unit, tenant } = createOccupiedUnit();
  db.setDateMode("custom", "2026-01-11");
  const payment = db.markPaymentPaid(tenant.id, tenant.dueDate);

  const result = db.refundPayment(payment.id, 200000);
  const data = db.getAll();

  assert.equal(result.expense.category, "Pengembalian Uang / Refund");
  assert.equal(result.expense.description, "Pengembalian uang sewa/DP an. Taufik - Batal Sewa");
  assert.equal(result.expense.amount, 200000);
  assert.equal(result.expense.date, "2026-01-11");
  assert.equal(result.expense.scope, "unit");
  assert.equal(result.expense.unitId, unit.id);
  assert.equal(result.expense.refundPaymentId, payment.id);
  assert.equal(data.payments.find((item) => item.id === payment.id).status, undefined);
  assert.equal(data.payments.find((item) => item.id === payment.id).amount, 500000);
  const activeIncome = data.payments.filter(isPaymentActive).reduce((total, item) => total + item.amount, 0);
  const totalExpenses = data.expenses.reduce((total, item) => total + item.amount, 0);
  assert.equal(activeIncome - totalExpenses, 300000);
  assert.equal(data.tenants.find((item) => item.id === tenant.id).status, "CANCELLED");
  assert.equal(data.units.find((item) => item.id === unit.id).status, "VACANT");
  assert.equal(result.refundedTotal, 200000);
  assert.equal(result.remainingRefund, 300000);
  assert.throws(() => db.cancelPayment(payment.id), /sudah memiliki refund/);
});

test("property owner simulation: ten-room setup, paid tenant refund, and unpaid cancellation", () => {
  const service = new LocalDatabaseService(new MemoryStorage());
  const category = service.createCategory({ name: "Kos Putra" });
  const property = service.createProperty({
    categoryId: category.id,
    name: "Kos Managerku Premier - 10 Kamar"
  });
  const units = Array.from({ length: 10 }, (_, index) => service.createUnit({
    propertyId: property.id,
    unitName: `Kamar ${String(index + 1).padStart(2, "0")}`,
    type: index < 2 ? "VIP" : "Reguler",
    price: 500000,
    facilities: index === 0 ? ["AC", "WiFi"] : []
  }));
  assert.deepEqual(service.getById("units", units[0].id).facilities, ["AC", "WiFi"]);
  const paidTenant = service.createTenant({
    unitId: units[0].id,
    name: "Penyewa A",
    whatsapp: "081234567890",
    startDate: "2026-11-01",
    dueDate: "2026-12-01"
  });
  const unpaidTenant = service.createTenant({
    unitId: units[1].id,
    name: "Penyewa B",
    whatsapp: "081234567891",
    startDate: "2026-11-01",
    dueDate: "2026-12-01"
  });

  service.setDateMode("custom", "2026-11-05");
  const paidRecord = service.markPaymentPaid(paidTenant.id, paidTenant.dueDate);
  const refund = service.refundPayment(paidRecord.id, 500000);
  const financialsBeforeCancellation = service.getAll();

  assert.equal(refund.expense.amount, 500000);
  assert.equal(refund.expense.description, "Pengembalian uang sewa/DP an. Penyewa A - Batal Sewa");
  assert.equal(service.getById("units", units[0].id).status, "VACANT");
  assert.equal(service.getAll().payments.some((payment) => payment.id === paidRecord.id), true);

  service.cancelRental(unpaidTenant.id);
  const finalData = service.getAll();
  assert.equal(finalData.tenants.some((tenant) => tenant.id === unpaidTenant.id), false);
  assert.equal(service.getById("units", units[1].id).status, "VACANT");
  assert.deepEqual(finalData.expenses, financialsBeforeCancellation.expenses);
  assert.deepEqual(finalData.payments, financialsBeforeCancellation.payments);
  assert.equal(finalData.units.length, 10);
  assert.equal(finalData.properties[0].name, "Kos Managerku Premier - 10 Kamar");
});

test("DP creates a persistent invoice with balance, refund updates invoice status, and income stays auditable", () => {
  const storage = new MemoryStorage();
  const service = new LocalDatabaseService(storage);
  service.setDateMode("custom", "2026-11-05");
  const category = service.createCategory({ name: "Kos Premier" });
  const property = service.createProperty({ categoryId: category.id, name: "Kos Managerku Premier" });
  const unit = service.createUnit({
    propertyId: property.id,
    unitName: "Kamar 01",
    type: "VIP",
    price: 1500000,
    facilities: ["AC", "WiFi"]
  });
  const tenant = service.createTenant({
    unitId: unit.id,
    name: "Penyewa A",
    whatsapp: "081234567890",
    startDate: "2026-11-05",
    dueDate: "2026-12-05"
  });
  const [invoice] = service.getAll().invoices;

  assert.match(invoice.invoiceId, /^INV\/202611\/001$/);
  assert.equal(invoice.tenantId, tenant.id);
  assert.equal(invoice.tenantName, "Penyewa A");
  assert.equal(invoice.unitNumber, "Kamar 01");
  assert.equal(invoice.propertyName, "Kos Managerku Premier");
  assert.equal(invoice.amount, 1500000);
  assert.equal(invoice.status, "UNPAID");

  const payment = service.recordInvoicePayment(invoice.id, 500000, "DP / Uang Muka");
  const partlyPaidInvoice = service.getById("invoices", invoice.id);
  assert.equal(payment.paymentType, "DP / Uang Muka");
  assert.equal(payment.amount, 500000);
  assert.equal(partlyPaidInvoice.status, "PARTIALLY_PAID");
  assert.equal(partlyPaidInvoice.remainingAmount, 1000000);
  assert.throws(() => service.recordInvoicePayment(invoice.id, 1000001, "DP / Uang Muka"), /tidak melebihi sisa/);
  assert.throws(() => service.recordInvoicePayment(invoice.id, 500000.5, "DP / Uang Muka"), /bilangan Rupiah bulat/);

  const nextInvoice = service.ensureInvoice(tenant.id, "2027-01-05");
  assert.equal(nextInvoice.invoiceId, "INV/202611/002");
  assert.equal(service.ensureInvoice(tenant.id, "2027-01-05").id, nextInvoice.id);

  const refund = service.refundPayment(payment.id, 500000);
  const finalData = service.getAll();
  assert.equal(finalData.invoices.find((item) => item.id === invoice.id).status, "REFUNDED");
  assert.equal(finalData.invoices.find((item) => item.id === invoice.id).remainingAmount, 0);
  assert.equal(finalData.invoices.find((item) => item.id === nextInvoice.id).status, "CANCELLED");
  assert.equal(finalData.expenses.find((item) => item.id === refund.expense.id).amount, 500000);
  assert.equal(finalData.payments.find((item) => item.id === payment.id).amount, 500000);
  assert.equal(finalData.payments.filter(isPaymentActive).reduce((total, item) => total + item.amount, 0) -
    finalData.expenses.reduce((total, item) => total + item.amount, 0), 0);
  assert.equal(finalData.units.find((item) => item.id === unit.id).status, "VACANT");
  assert.equal(finalData.tenants.find((item) => item.id === tenant.id).status, "CANCELLED");
  assert.equal(new LocalDatabaseService(storage).getById("invoices", invoice.id).status, "REFUNDED");
});

test("refund cannot exceed remaining paid amount and later refund does not vacate a new tenant's unit", () => {
  const { unit, tenant } = createOccupiedUnit();
  db.setDateMode("custom", "2026-01-11");
  const payment = db.markPaymentPaid(tenant.id, tenant.dueDate);

  db.refundPayment(payment.id, 200000);
  const beforeRejectedRefund = db.getAll();
  assert.throws(() => db.refundPayment(payment.id, 300001), /melebihi sisa/);
  assert.deepEqual(db.getAll(), beforeRejectedRefund);

  const newTenant = db.createTenant({
    unitId: unit.id,
    name: "Penyewa Baru",
    whatsapp: "081122233344",
    startDate: "2026-01-12",
    dueDate: "2026-02-12"
  });
  db.refundPayment(payment.id, 300000);

  assert.equal(db.getById("tenants", tenant.id).status, "CANCELLED");
  assert.equal(db.getById("tenants", newTenant.id).status, "ACTIVE");
  assert.equal(db.getById("units", unit.id).status, "OCCUPIED");
  assert.equal(db.getAll().expenses.filter((expense) => expense.refundPaymentId === payment.id)
    .reduce((total, expense) => total + expense.amount, 0), 500000);
});

test("closing books archives all active financial years and clears active dashboard transactions", () => {
  const service = new LocalDatabaseService(new MemoryStorage());
  const category = service.createCategory({ name: "Kos Putra" });
  const property = service.createProperty({ categoryId: category.id, name: "Kos Melati" });
  const firstUnit = service.createUnit({
    propertyId: property.id, unitName: "Kamar 01", type: "Reguler", price: 500000
  });
  const secondUnit = service.createUnit({
    propertyId: property.id, unitName: "Kamar 02", type: "Reguler", price: 600000
  });
  const firstTenant = service.createTenant({
    unitId: firstUnit.id, name: "Taufik", whatsapp: "081234567890",
    startDate: "2023-01-01", dueDate: "2023-01-10"
  });
  const secondTenant = service.createTenant({
    unitId: secondUnit.id, name: "Verania", whatsapp: "081111111111",
    startDate: "2024-01-01", dueDate: "2024-01-10"
  });

  service.setDateMode("custom", "2023-01-10");
  service.markPaymentPaid(firstTenant.id, "2023-01-10");
  const previousArchive = service.archiveAnnualReport(2023);
  service.updateTenant(firstTenant.id, {
    name: "Taufik Baru", whatsapp: "081111111111",
    dueDate: "2023-02-10", specialTerms: ""
  });
  service.markPaymentPaid(firstTenant.id, "2023-02-10");
  service.createExpense({
    scope: "property", propertyId: property.id, unitId: null,
    category: "Perbaikan", amount: 100000, description: "Perbaikan awal", date: "2023-03-01"
  });

  service.setDateMode("custom", "2024-01-10");
  const cancelledPayment = service.markPaymentPaid(firstTenant.id, "2024-01-10");
  service.cancelPayment(cancelledPayment.id);
  service.markPaymentPaid(secondTenant.id, "2024-01-10");
  service.createExpense({
    scope: "property", propertyId: property.id, unitId: null,
    category: "Perawatan", amount: 200000, description: "Perawatan tahunan", date: "2024-04-01"
  });

  const report = service.closeAnnualBooks(2024);
  const data = service.getAll();
  const archived2023 = data.archives.find((archive) => archive.year === 2023);

  assert.equal(report.year, 2024);
  assert.deepEqual(report.counts, { income: 1, expenses: 1 });
  assert.equal(report.totals.income, 600000);
  assert.equal(report.totals.expenses, 200000);
  assert.equal(archived2023.id, previousArchive.id);
  assert.deepEqual(archived2023.counts, { income: 2, expenses: 1 });
  assert.equal(archived2023.totals.income, 1000000);
  assert.equal(archived2023.totals.expenses, 100000);
  assert.equal(archived2023.transactions.find((transaction) => transaction.id === previousArchive.transactions[0].id).tenantName, "Taufik");
  assert.equal(data.payments.length, 1);
  assert.equal(data.payments[0].id, cancelledPayment.id);
  assert.deepEqual(data.expenses, []);
  assert.equal(data.units.length, 2);
  assert.equal(data.tenants.length, 2);
  assert.throws(() => service.cancelRental(firstTenant.id), /riwayat pembayaran/);
  assert.equal(service.getById("tenants", firstTenant.id).name, "Taufik Baru");
});
