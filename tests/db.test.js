import test from "node:test";
import assert from "node:assert/strict";
import { db, setUserStorageScope } from "../Assets/js/db.js";

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
