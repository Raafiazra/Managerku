import { getCurrentAppDate } from "./db.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function dateToUtc(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function formatDateString(timestamp) {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addMonthsClamped(dateString, count) {
  const [year, month, day] = dateString.split("-").map(Number);
  const targetMonth = month - 1 + count;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  return formatDateString(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay)));
}

export function dayDifference(fromDate, toDate) {
  return Math.round((dateToUtc(toDate) - dateToUtc(fromDate)) / DAY_MS);
}

export function getBillingStatus(tenant, payments, today = getCurrentAppDate()) {
  let dueDate = tenant.dueDate;
  let cycle = 0;
  const hasPayment = (date) => payments.some((payment) =>
    payment.tenantId === tenant.id && payment.dueDate?.slice(0, 7) === date.slice(0, 7)
  );

  while (hasPayment(dueDate) && cycle < 240) {
    const nextDueDate = addMonthsClamped(tenant.dueDate, cycle + 1);
    if (dayDifference(today, nextDueDate) > 3) break;
    cycle += 1;
    dueDate = nextDueDate;
  }

  if (hasPayment(dueDate)) return { code: "PAID", label: "LUNAS", dueDate, daysUntilDue: dayDifference(today, dueDate) };

  const daysUntilDue = dayDifference(today, dueDate);
  if (daysUntilDue <= 3 && daysUntilDue >= 1) return { code: "DUE_SOON", label: "H-3 JATUH TEMPO", dueDate, daysUntilDue };
  if (daysUntilDue === 0) return { code: "DUE_TODAY", label: "JATUH TEMPO HARI INI", dueDate, daysUntilDue };
  if (daysUntilDue <= -7) return { code: "OVERDUE_CRITICAL", label: "TUNGGAKAN KRITIS", dueDate, daysUntilDue };
  if (daysUntilDue <= -3) return { code: "OVERDUE_L1", label: "TUNGGAKAN", dueDate, daysUntilDue };
  return { code: "UPCOMING", label: "BELUM JATUH TEMPO", dueDate, daysUntilDue };
}

export function getOverdueReminder(status) {
  if (status.code === "PAID" || status.daysUntilDue > 0) return null;
  const overdueDays = Math.max(0, -status.daysUntilDue);
  if (overdueDays % 3 !== 0) return null;
  return {
    number: Math.floor(overdueDays / 3) + 1,
    overdueDays,
    daysUntilNext: 3
  };
}

export function isSeverelyOverdue(status) {
  return status.code !== "PAID" && status.daysUntilDue <= -90;
}

export function getBillingMessage(tenant, unit, property, status) {
  const due = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" })
    .format(new Date(`${status.dueDate}T00:00:00Z`));
  const amount = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(unit.price);
  const greeting = `Halo ${tenant.name},`;
  const messages = {
    DUE_SOON: `${greeting} kami ingin mengingatkan dengan ramah bahwa pembayaran sewa ${unit.unitName} di ${property.name} sebesar ${amount} akan jatuh tempo pada ${due}. Terima kasih.`,
    DUE_TODAY: `${greeting} pembayaran sewa ${unit.unitName} di ${property.name} sebesar ${amount} jatuh tempo hari ini (${due}). Mohon konfirmasi setelah pembayaran. Terima kasih.`,
    OVERDUE_L1: `${greeting} kami mengingatkan bahwa pembayaran sewa ${unit.unitName} di ${property.name} sebesar ${amount} telah melewati jatuh tempo ${due}. Mohon segera melakukan pembayaran atau menghubungi kami jika ada kendala.`,
    OVERDUE_CRITICAL: `${greeting} pembayaran sewa ${unit.unitName} di ${property.name} sebesar ${amount} masih belum kami terima dan telah melewati jatuh tempo ${due}. Mohon segera menyelesaikan pembayaran dan menghubungi pengelola hari ini. Terima kasih.`,
    UPCOMING: `${greeting} berikut informasi sewa ${unit.unitName} di ${property.name}: ${amount}, jatuh tempo ${due}.`
  };
  return messages[status.code] ?? messages.UPCOMING;
}

export function getWhatsAppUrl(phone, message) {
  const number = String(phone).replace(/\D/g, "").replace(/^0/, "62");
  if (number.length < 8) throw new Error("Nomor WhatsApp penyewa tidak valid.");
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function formatRupiah(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(amount) || 0);
}