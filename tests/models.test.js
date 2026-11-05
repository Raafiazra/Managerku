import test from "node:test";
import assert from "node:assert/strict";
import { Unit } from "../src/models/WorkspaceEntities.js";

test("Firestore entities preserve record shape without exposing mutable internal state", () => {
  const source = { propertyId: "property-1", unitName: "Kamar 01", status: "VACANT" };
  const unit = Unit.fromFirestore("unit-1", source);
  source.unitName = "Changed outside the model";

  assert.equal(unit.id, "unit-1");
  assert.equal(unit.get("unitName"), "Kamar 01");
  assert.deepEqual(unit.toFirestore(), {
    id: "unit-1",
    propertyId: "property-1",
    unitName: "Kamar 01",
    status: "VACANT"
  });
});
