import test from "node:test";
import assert from "node:assert/strict";
import { getBillingStatus, getOverdueReminder, isSeverelyOverdue } from "../Assets/js/billing.js";

test("overdue reminders start on the due date and repeat every three days", () => {
  const tenant = { id: "tenant-1", dueDate: "2026-05-10" };
  const reminderAt = (today) => getOverdueReminder(getBillingStatus(tenant, [], today));

  assert.deepEqual(reminderAt("2026-05-10"), { number: 1, overdueDays: 0, daysUntilNext: 3 });
  assert.equal(reminderAt("2026-05-12"), null);
  assert.equal(reminderAt("2026-05-13").number, 2);
  assert.equal(reminderAt("2026-05-16").number, 3);
  assert.equal(reminderAt("2026-05-19").number, 4);
  assert.equal(reminderAt("2026-05-22").number, 5);
  assert.equal(reminderAt("2026-05-09"), null);
});

test("overdue warning threshold includes exactly 90 days", () => {
  const status = getBillingStatus(
    { id: "tenant-1", dueDate: "2026-01-10" },
    [],
    "2026-04-10"
  );

  assert.equal(status.daysUntilDue, -90);
  assert.equal(status.code, "OVERDUE_CRITICAL");
  assert.equal(getOverdueReminder(status).overdueDays, 90);
  assert.equal(isSeverelyOverdue(status), true);
  assert.equal(isSeverelyOverdue({ code: "OVERDUE_CRITICAL", daysUntilDue: -89 }), false);
  assert.equal(isSeverelyOverdue({ code: "PAID", daysUntilDue: -120 }), false);
});

test("payment for a cycle remains paid after its due day is corrected within the month", () => {
  const tenant = { id: "tenant-1", dueDate: "2026-05-05" };
  const payments = [{ tenantId: "tenant-1", dueDate: "2026-05-15" }];

  assert.equal(getBillingStatus(tenant, payments, "2026-05-20").code, "PAID");
  assert.equal(getBillingStatus(tenant, payments, "2026-06-02").dueDate, "2026-06-05");
  assert.equal(getBillingStatus(tenant, payments, "2026-06-02").code, "DUE_SOON");
});
