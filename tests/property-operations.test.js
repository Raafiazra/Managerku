import test from "node:test";
import assert from "node:assert/strict";
import {
  createDepositReceipt,
  createJournalEntry,
  createWorkOrder,
  getArrearsReport,
  getContractStatus,
  getProfitAndLoss,
  getTrialBalance,
  settleSecurityDeposit,
  transitionWorkOrder
} from "../src/services/property-operations.js";
import {
  sampleContracts,
  sampleJournalEntries,
  sampleObligations,
  sampleObligationPayments,
  sampleWorkOrder
} from "./fixtures/property-operations.mock.js";

test("journal entries must balance and trial balance matches spreadsheet totals", () => {
  assert.throws(() => createJournalEntry({
    id: "unbalanced",
    date: "2026-01-01",
    description: "Jurnal tidak seimbang",
    lines: [
      { accountId: "cash", accountType: "asset", debit: 1000 },
      { accountId: "rent-income", accountType: "income", credit: 900 }
    ]
  }), /tidak seimbang/);

  const trialBalance = getTrialBalance(sampleJournalEntries);
  assert.equal(trialBalance.balanced, true);
  assert.equal(trialBalance.debitTotal, 2200000);
  assert.equal(trialBalance.creditTotal, 2200000);
  assert.equal(trialBalance.accounts.find((account) => account.accountId === "cash").balance, 900000);
  assert.equal(trialBalance.accounts.find((account) => account.accountId === "tenant-deposits-payable").balance, 0);
});

test("profit and loss excludes refundable deposit liabilities and calculates net", () => {
  assert.deepEqual(
    getProfitAndLoss(sampleJournalEntries, "2026-01-01", "2026-01-31"),
    { fromDate: "2026-01-01", toDate: "2026-01-31", income: 1100000, expenses: 200000, net: 900000 }
  );
});

test("deposit receipt and settlement balance and preserve liability treatment", () => {
  const { deposit, journalEntry: receipt } = createDepositReceipt({
    id: "deposit-test",
    tenantId: "tenant-01",
    amount: 500000,
    date: "2026-01-01"
  });
  assert.equal(receipt.lines[1].accountType, "liability");

  const settlement = settleSecurityDeposit({
    deposit,
    date: "2026-02-01",
    refundAmount: 400000,
    deductionAmount: 100000
  });
  assert.equal(settlement.deposit.status, "PARTIALLY_DEDUCTED");
  assert.equal(settlement.journalEntry.debitTotal, 500000);
  assert.equal(settlement.journalEntry.creditTotal, 500000);
  assert.throws(() => settleSecurityDeposit({
    deposit: settlement.deposit,
    date: "2026-02-02",
    refundAmount: 500000,
    deductionAmount: 0
  }), /sudah diselesaikan/);
});

test("contract status and arrears agree with sample schedule calculations", () => {
  assert.deepEqual(getContractStatus(sampleContracts[0], "2026-01-31"), {
    status: "ACTIVE",
    daysUntilEnd: 150
  });
  assert.deepEqual(getContractStatus(sampleContracts[1], "2026-03-20"), {
    status: "EXPIRING_SOON",
    daysUntilEnd: 11
  });
  assert.deepEqual(
    getArrearsReport(sampleObligations, sampleObligationPayments, "2026-01-20"),
    [{
      obligationId: "obligation-002",
      tenantId: "tenant-002",
      dueDate: "2026-01-05",
      expected: 800000,
      paid: 300000,
      outstanding: 500000,
      overdueDays: 15
    }]
  );
});

test("work orders have an append-only status history and disallow terminal transitions", () => {
  const created = createWorkOrder({
    id: "work-order-test",
    unitId: "unit-01",
    title: "Lampu mati",
    description: "Lampu kamar tidak menyala.",
    createdAt: "2026-01-01T10:00:00Z"
  });
  const inProgress = transitionWorkOrder(created, "IN_PROGRESS", {
    at: "2026-01-01T11:00:00Z",
    actor: "staff-01"
  });
  const completed = transitionWorkOrder(inProgress, "COMPLETED", {
    at: "2026-01-02T09:00:00Z",
    actor: "manager-01"
  });

  assert.equal(completed.history.length, 3);
  assert.equal(completed.completedAt, "2026-01-02T09:00:00.000Z");
  assert.throws(() => transitionWorkOrder(completed, "OPEN", {
    at: "2026-01-03T09:00:00Z",
    actor: "manager-01"
  }), /tidak diizinkan/);
  assert.equal(sampleWorkOrder.status, "OPEN");
});
