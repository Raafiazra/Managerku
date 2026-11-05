import test from "node:test";
import assert from "node:assert/strict";
import { db, LocalDatabaseService, setUserStorageScope } from "../Assets/js/db.js";

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
});

test("canceling a rental with payment history is rejected without changing data", () => {
  const { unit, tenant } = createOccupiedUnit();
  db.markPaymentPaid(tenant.id, tenant.dueDate);
  const before = db.getAll();

  assert.throws(() => db.cancelRental(tenant.id), /Gunakan Checkout/);
  assert.deepEqual(db.getAll(), before);
  assert.equal(db.getById("units", unit.id).status, "OCCUPIED");
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
