import { createJournalEntry } from "../../src/services/property-operations.js";

export const sampleJournalEntries = [
  createJournalEntry({
    id: "journal-rent-001",
    date: "2026-01-05",
    description: "Pembayaran sewa Januari",
    source: "rent-payment",
    lines: [
      { accountId: "cash", accountType: "asset", debit: 1000000 },
      { accountId: "rent-income", accountType: "income", credit: 1000000 }
    ]
  }),
  createJournalEntry({
    id: "journal-utility-001",
    date: "2026-01-10",
    description: "Pembayaran listrik dan air",
    source: "utility-expense",
    lines: [
      { accountId: "utilities-expense", accountType: "expense", debit: 200000 },
      { accountId: "cash", accountType: "asset", credit: 200000 }
    ]
  }),
  createJournalEntry({
    id: "deposit-001:receipt",
    date: "2026-01-02",
    description: "Penerimaan deposit penyewa tenant-001",
    source: "security-deposit",
    lines: [
      { accountId: "cash", accountType: "asset", debit: 500000 },
      { accountId: "tenant-deposits-payable", accountType: "liability", credit: 500000 }
    ]
  }),
  createJournalEntry({
    id: "deposit-001:settlement",
    date: "2026-01-31",
    description: "Pengembalian deposit setelah potongan kerusakan",
    source: "security-deposit",
    lines: [
      { accountId: "tenant-deposits-payable", accountType: "liability", debit: 500000 },
      { accountId: "cash", accountType: "asset", credit: 400000 },
      { accountId: "damage-recovery", accountType: "income", credit: 100000 }
    ]
  })
];

export const sampleContracts = [
  {
    id: "contract-001",
    tenantId: "tenant-001",
    unitId: "unit-01",
    startDate: "2025-07-01",
    endDate: "2026-06-30"
  },
  {
    id: "contract-002",
    tenantId: "tenant-002",
    unitId: "unit-02",
    startDate: "2025-12-01",
    endDate: "2026-03-31"
  }
];

export const sampleObligations = [
  { id: "obligation-001", tenantId: "tenant-001", dueDate: "2026-01-05", amount: 1000000 },
  { id: "obligation-002", tenantId: "tenant-002", dueDate: "2026-01-05", amount: 800000 },
  { id: "obligation-003", tenantId: "tenant-003", dueDate: "2026-02-05", amount: 900000 }
];

export const sampleObligationPayments = [
  { id: "payment-001", obligationId: "obligation-001", amount: 1000000, status: "PAID" },
  { id: "payment-002", obligationId: "obligation-002", amount: 300000, status: "PAID" },
  { id: "payment-003", obligationId: "obligation-002", amount: 100000, status: "CANCELLED" }
];

export const sampleWorkOrder = {
  id: "work-order-001",
  unitId: "unit-02",
  tenantId: "tenant-002",
  title: "Keran bocor",
  description: "Keran wastafel menetes terus dan perlu diperiksa.",
  priority: "HIGH",
  status: "OPEN",
  createdAt: "2026-01-12T09:00:00.000Z",
  updatedAt: "2026-01-12T09:00:00.000Z",
  history: [{ status: "OPEN", at: "2026-01-12T09:00:00.000Z" }]
};
