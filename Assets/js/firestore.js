import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db as firestore } from "../../config/firebase.js";

const recordCollections = ["categories", "properties", "units", "tenants", "expenses", "payments", "archives"];
const queues = new Map();
const cachedData = new Map();

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

const clone = (value) => JSON.parse(JSON.stringify(value));
const recordsPath = (uid, name) => collection(firestore, "users", uid, name);

export async function loadUserData(uid) {
  const data = emptyData();
  let hasRecords = false;
  const snapshots = await Promise.all(recordCollections.map((name) => getDocs(recordsPath(uid, name))));

  snapshots.forEach((snapshot, index) => {
    const name = recordCollections[index];
    data[name] = snapshot.docs.map((record) => ({ id: record.id, ...record.data() }));
    hasRecords ||= data[name].length > 0;
  });

  const settingsSnapshot = await getDoc(doc(firestore, "users", uid, "settings", "app"));
  if (settingsSnapshot.exists()) {
    const settings = settingsSnapshot.data();
    data.dateMode = settings.dateMode === "custom" ? "custom" : "device";
    data.customDate = typeof settings.customDate === "string" ? settings.customDate : null;
    data.activeYear = Number.isInteger(settings.activeYear) ? settings.activeYear : data.activeYear;
  }
  data.activeYear = data.dateMode === "custom" && data.customDate
    ? Number(data.customDate.slice(0, 4))
    : new Date().getFullYear();

  cachedData.set(uid, clone(data));
  return { data, hasRecords };
}

function makeOperations(uid, previous, next) {
  const operations = [];
  for (const name of recordCollections) {
    const previousRecords = new Map((previous[name] ?? []).map((record) => [record.id, record]));
    const nextRecords = new Map((next[name] ?? []).map((record) => [record.id, record]));
    for (const [id, record] of nextRecords) {
      if (JSON.stringify(previousRecords.get(id)) === JSON.stringify(record)) continue;
      operations.push({ type: "set", reference: doc(firestore, "users", uid, name, id), data: record });
    }
    for (const id of previousRecords.keys()) {
      if (!nextRecords.has(id)) operations.push({ type: "delete", reference: doc(firestore, "users", uid, name, id) });
    }
  }

  const previousSettings = {
    dateMode: previous.dateMode,
    customDate: previous.customDate,
    activeYear: previous.activeYear
  };
  const nextSettings = {
    dateMode: next.dateMode,
    customDate: next.customDate,
    activeYear: next.activeYear
  };
  if (JSON.stringify(previousSettings) !== JSON.stringify(nextSettings)) {
    operations.push({ type: "set", reference: doc(firestore, "users", uid, "settings", "app"), data: nextSettings });
  }
  return operations;
}

async function writeOperations(operations) {
  for (let offset = 0; offset < operations.length; offset += 450) {
    const batch = writeBatch(firestore);
    operations.slice(offset, offset + 450).forEach((operation) => {
      if (operation.type === "set") batch.set(operation.reference, operation.data);
      else batch.delete(operation.reference);
    });
    await batch.commit();
  }
}

export function saveUserData(uid, data) {
  const previousQueue = queues.get(uid) ?? Promise.resolve();
  const nextQueue = previousQueue
    .catch(() => undefined)
    .then(async () => {
      const previous = cachedData.get(uid);
      if (!previous) throw new Error("Data Firestore belum dimuat untuk akun ini.");
      const next = clone(data);
      await writeOperations(makeOperations(uid, previous, next));
      cachedData.set(uid, next);
    });
  queues.set(uid, nextQueue);
  return nextQueue.finally(() => {
    if (queues.get(uid) === nextQueue) queues.delete(uid);
  });
}

export async function flushUserWrites(uid) {
  await (queues.get(uid) ?? Promise.resolve());
}

export async function importUserData(uid, data) {
  cachedData.set(uid, emptyData());
  await saveUserData(uid, data);
}
