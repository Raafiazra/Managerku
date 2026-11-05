const accountTypes = new Set(["asset", "liability", "equity", "income", "expense"]);
const workOrderStatuses = new Set(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);
const DAY_MS = 24 * 60 * 60 * 1000;

function assertDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) {
    throw new Error(`${label} harus menggunakan format YYYY-MM-DD.`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error(`${label} bukan tanggal yang valid.`);
  }
  return value;
}

function amount(value, label) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error(`${label} harus berupa nominal Rupiah bilangan bulat nol atau lebih.`);
  }
  return result;
}

function requiredText(value, label) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${label} wajib diisi.`);
  return result;
}

function createLine(accountId, accountType, debit, credit) {
  return { accountId, accountType, debit, credit };
}

function createJournalEntry({ id, date, description, source, lines }) {
  const entryDate = assertDate(date, "Tanggal jurnal");
  const memo = requiredText(description, "Deskripsi jurnal");
  if (!Array.isArray(lines) || lines.length < 2) throw new Error("Jurnal harus memiliki sedikitnya dua baris.");

  const normalizedLines = lines.map((line) => {
    const accountId = requiredText(line.accountId, "Akun");
    if (!accountTypes.has(line.accountType)) throw new Error(`Tipe akun tidak valid: ${line.accountType}.`);
    const debit = amount(line.debit ?? 0, "Debit");
    const credit = amount(line.credit ?? 0, "Kredit");
    if ((debit === 0) === (credit === 0)) throw new Error("Setiap baris jurnal harus memiliki debit atau kredit, bukan keduanya.");
    return createLine(accountId, line.accountType, debit, credit);
  });
  const debitTotal = normalizedLines.reduce((total, line) => total + line.debit, 0);
  const creditTotal = normalizedLines.reduce((total, line) => total + line.credit, 0);
  if (debitTotal !== creditTotal) throw new Error("Jurnal tidak seimbang: total debit harus sama dengan total kredit.");

  return {
    id: requiredText(id, "ID jurnal"),
    date: entryDate,
    description: memo,
    source: source ? requiredText(source, "Sumber jurnal") : "manual",
    lines: normalizedLines,
    debitTotal,
    creditTotal
  };
}

function getTrialBalance(entries) {
  const accounts = new Map();
  for (const entry of entries) {
    const validated = createJournalEntry(entry);
    for (const line of validated.lines) {
      const current = accounts.get(line.accountId) ?? {
        accountId: line.accountId,
        accountType: line.accountType,
        debit: 0,
        credit: 0
      };
      if (current.accountType !== line.accountType) {
        throw new Error(`Tipe akun ${line.accountId} tidak konsisten antarjurnal.`);
      }
      current.debit += line.debit;
      current.credit += line.credit;
      accounts.set(line.accountId, current);
    }
  }

  const balances = [...accounts.values()].map((account) => ({
    ...account,
    balance: account.debit - account.credit
  }));
  const debitTotal = balances.reduce((total, account) => total + account.debit, 0);
  const creditTotal = balances.reduce((total, account) => total + account.credit, 0);
  return { accounts: balances, debitTotal, creditTotal, balanced: debitTotal === creditTotal };
}

function getProfitAndLoss(entries, fromDate, toDate) {
  const start = assertDate(fromDate, "Tanggal awal");
  const end = assertDate(toDate, "Tanggal akhir");
  if (start > end) throw new Error("Tanggal awal laporan tidak boleh melewati tanggal akhir.");
  let income = 0;
  let expenses = 0;

  for (const entry of entries) {
    const validated = createJournalEntry(entry);
    if (validated.date < start || validated.date > end) continue;
    for (const line of validated.lines) {
      if (line.accountType === "income") income += line.credit - line.debit;
      if (line.accountType === "expense") expenses += line.debit - line.credit;
    }
  }
  return { fromDate: start, toDate: end, income, expenses, net: income - expenses };
}

function createDepositReceipt({
  id,
  tenantId,
  amount: depositAmount,
  date,
  cashAccountId = "cash",
  liabilityAccountId = "tenant-deposits-payable"
}) {
  const value = amount(depositAmount, "Deposit");
  if (value === 0) throw new Error("Deposit harus lebih besar dari nol.");
  const tenant = requiredText(tenantId, "ID penyewa");
  const receiptDate = assertDate(date, "Tanggal deposit");
  const depositId = requiredText(id, "ID deposit");
  return {
    deposit: { id: depositId, tenantId: tenant, amount: value, receivedDate: receiptDate, status: "HELD" },
    journalEntry: createJournalEntry({
      id: `${depositId}:receipt`,
      date: receiptDate,
      description: `Penerimaan deposit penyewa ${tenant}`,
      source: "security-deposit",
      lines: [
        { accountId: cashAccountId, accountType: "asset", debit: value },
        { accountId: liabilityAccountId, accountType: "liability", credit: value }
      ]
    })
  };
}

function settleSecurityDeposit({
  deposit,
  date,
  refundAmount,
  deductionAmount,
  cashAccountId = "cash",
  liabilityAccountId = "tenant-deposits-payable",
  deductionAccountId = "deposit-deductions-clearing",
  id = `${deposit?.id}:settlement`
}) {
  if (!deposit || deposit.status !== "HELD") throw new Error("Deposit tidak ditemukan atau sudah diselesaikan.");
  const refund = amount(refundAmount, "Pengembalian deposit");
  const deduction = amount(deductionAmount, "Potongan deposit");
  const depositAmount = amount(deposit.amount, "Nilai deposit");
  if (refund + deduction !== depositAmount) throw new Error("Pengembalian dan potongan harus sama dengan nilai deposit.");
  if (refund === 0 && deduction === 0) throw new Error("Penyelesaian deposit tidak boleh bernilai nol.");

  const settlementDate = assertDate(date, "Tanggal penyelesaian deposit");
  const lines = [
    { accountId: liabilityAccountId, accountType: "liability", debit: depositAmount }
  ];
  if (refund > 0) lines.push({ accountId: cashAccountId, accountType: "asset", credit: refund });
  if (deduction > 0) lines.push({ accountId: deductionAccountId, accountType: "income", credit: deduction });

  const status = deduction === 0 ? "REFUNDED" : refund === 0 ? "DEDUCTED" : "PARTIALLY_DEDUCTED";
  return {
    deposit: { ...deposit, status, refundAmount: refund, deductionAmount: deduction, settledDate: settlementDate },
    journalEntry: createJournalEntry({
      id: requiredText(id, "ID jurnal penyelesaian"),
      date: settlementDate,
      description: `Penyelesaian deposit penyewa ${deposit.tenantId}`,
      source: "security-deposit",
      lines
    })
  };
}

function getContractStatus(contract, asOfDate, expiringWithinDays = 30) {
  const today = assertDate(asOfDate, "Tanggal pemeriksaan kontrak");
  const startDate = assertDate(contract.startDate, "Tanggal mulai kontrak");
  const endDate = assertDate(contract.endDate, "Tanggal akhir kontrak");
  const days = amount(expiringWithinDays, "Batas pengingat kontrak");
  if (startDate > endDate) throw new Error("Tanggal mulai kontrak harus sebelum tanggal akhir.");
  const daysUntilEnd = Math.floor((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);

  if (today < startDate) return { status: "UPCOMING", daysUntilEnd };
  if (today > endDate) return { status: "EXPIRED", daysUntilEnd };
  if (daysUntilEnd <= days) return { status: "EXPIRING_SOON", daysUntilEnd };
  return { status: "ACTIVE", daysUntilEnd };
}

function getArrearsReport(obligations, payments, asOfDate) {
  const today = assertDate(asOfDate, "Tanggal laporan tunggakan");
  const paidByObligation = new Map();
  for (const payment of payments) {
    if (payment.status === "CANCELLED") continue;
    const paymentAmount = amount(payment.amount, "Pembayaran");
    paidByObligation.set(payment.obligationId, (paidByObligation.get(payment.obligationId) ?? 0) + paymentAmount);
  }

  return obligations.flatMap((obligation) => {
    const dueDate = assertDate(obligation.dueDate, "Tanggal jatuh tempo");
    if (dueDate >= today) return [];
    const expected = amount(obligation.amount, "Tagihan");
    const paid = paidByObligation.get(obligation.id) ?? 0;
    const outstanding = Math.max(0, expected - paid);
    if (outstanding === 0) return [];
    return [{
      obligationId: requiredText(obligation.id, "ID tagihan"),
      tenantId: requiredText(obligation.tenantId, "ID penyewa"),
      dueDate,
      expected,
      paid: Math.min(paid, expected),
      outstanding,
      overdueDays: Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / DAY_MS)
    }];
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.tenantId.localeCompare(b.tenantId));
}

function createWorkOrder({ id, unitId, tenantId = null, title, description, priority = "NORMAL", createdAt }) {
  const priorityValue = requiredText(priority, "Prioritas").toUpperCase();
  if (!["LOW", "NORMAL", "HIGH", "URGENT"].includes(priorityValue)) throw new Error("Prioritas work order tidak valid.");
  const timestamp = new Date(createdAt);
  if (!Number.isFinite(timestamp.getTime())) throw new Error("Waktu pembuatan work order tidak valid.");
  return {
    id: requiredText(id, "ID work order"),
    unitId: requiredText(unitId, "ID unit"),
    tenantId: tenantId ? requiredText(tenantId, "ID penyewa") : null,
    title: requiredText(title, "Judul kerusakan"),
    description: requiredText(description, "Deskripsi kerusakan"),
    priority: priorityValue,
    status: "OPEN",
    createdAt: timestamp.toISOString(),
    updatedAt: timestamp.toISOString(),
    history: [{ status: "OPEN", at: timestamp.toISOString() }]
  };
}

function transitionWorkOrder(workOrder, nextStatus, { at, actor }) {
  if (!workOrder || !workOrderStatuses.has(workOrder.status)) throw new Error("Work order tidak valid.");
  if (!workOrderStatuses.has(nextStatus)) throw new Error("Status work order tidak valid.");
  const transitions = {
    OPEN: new Set(["IN_PROGRESS", "CANCELLED"]),
    IN_PROGRESS: new Set(["COMPLETED", "CANCELLED"]),
    COMPLETED: new Set(),
    CANCELLED: new Set()
  };
  if (!transitions[workOrder.status].has(nextStatus)) {
    throw new Error(`Perubahan status ${workOrder.status} ke ${nextStatus} tidak diizinkan.`);
  }
  const timestamp = new Date(at);
  if (!Number.isFinite(timestamp.getTime())) throw new Error("Waktu perubahan work order tidak valid.");
  const event = {
    status: nextStatus,
    at: timestamp.toISOString(),
    actor: requiredText(actor, "Pengguna yang mengubah status")
  };
  return {
    ...workOrder,
    status: nextStatus,
    updatedAt: event.at,
    ...(nextStatus === "COMPLETED" ? { completedAt: event.at } : {}),
    ...(nextStatus === "CANCELLED" ? { cancelledAt: event.at } : {}),
    history: [...workOrder.history, event]
  };
}

export {
  createDepositReceipt,
  createJournalEntry,
  createWorkOrder,
  getArrearsReport,
  getProfitAndLoss,
  getTrialBalance,
  getContractStatus,
  settleSecurityDeposit,
  transitionWorkOrder
};
