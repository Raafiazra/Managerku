import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { collectionModels } from "../models/WorkspaceEntities.js";
import { firebaseFirestore } from "./firebase-client.js";

const recordCollections = Object.keys(collectionModels);

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

export class FirestoreService {
  #firestore;
  #queues = new Map();
  #cachedData = new Map();

  constructor(firestore = firebaseFirestore) {
    this.#firestore = firestore;
  }

  #recordsPath(uid, name) {
    return collection(this.#firestore, "users", uid, name);
  }

  #makeOperations(uid, previous, next) {
    const operations = [];
    for (const name of recordCollections) {
      const Model = collectionModels[name];
      const previousRecords = new Map((previous[name] ?? []).map((record) => [record.id, record]));
      const nextRecords = new Map((next[name] ?? []).map((record) => [record.id, record]));
      for (const [id, record] of nextRecords) {
        if (JSON.stringify(previousRecords.get(id)) === JSON.stringify(record)) continue;
        operations.push({
          type: "set",
          reference: doc(this.#firestore, "users", uid, name, id),
          data: new Model(record).toFirestore()
        });
      }
      for (const id of previousRecords.keys()) {
        if (!nextRecords.has(id)) {
          operations.push({ type: "delete", reference: doc(this.#firestore, "users", uid, name, id) });
        }
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
      operations.push({
        type: "set",
        reference: doc(this.#firestore, "users", uid, "settings", "app"),
        data: nextSettings
      });
    }
    return operations;
  }

  async #writeOperations(operations) {
    for (let offset = 0; offset < operations.length; offset += 450) {
      const batch = writeBatch(this.#firestore);
      operations.slice(offset, offset + 450).forEach((operation) => {
        if (operation.type === "set") batch.set(operation.reference, operation.data);
        else batch.delete(operation.reference);
      });
      await batch.commit();
    }
  }

  async loadUserData(uid) {
    const data = emptyData();
    let hasRecords = false;
    const snapshots = await Promise.all(recordCollections.map((name) => getDocs(this.#recordsPath(uid, name))));

    snapshots.forEach((snapshot, index) => {
      const name = recordCollections[index];
      const Model = collectionModels[name];
      data[name] = snapshot.docs.map((record) => Model.fromFirestore(record.id, record.data()).toJSON());
      hasRecords ||= data[name].length > 0;
    });

    const settingsSnapshot = await getDoc(doc(this.#firestore, "users", uid, "settings", "app"));
    if (settingsSnapshot.exists()) {
      const settings = settingsSnapshot.data();
      data.dateMode = settings.dateMode === "custom" ? "custom" : "device";
      data.customDate = typeof settings.customDate === "string" ? settings.customDate : null;
      data.activeYear = Number.isInteger(settings.activeYear) ? settings.activeYear : data.activeYear;
    }
    data.activeYear = data.dateMode === "custom" && data.customDate
      ? Number(data.customDate.slice(0, 4))
      : new Date().getFullYear();

    this.#cachedData.set(uid, clone(data));
    return { data, hasRecords };
  }

  saveUserData(uid, data) {
    const previousQueue = this.#queues.get(uid) ?? Promise.resolve();
    const nextQueue = previousQueue
      .catch(() => undefined)
      .then(async () => {
        const previous = this.#cachedData.get(uid);
        if (!previous) throw new Error("Data Firestore belum dimuat untuk akun ini.");
        const next = clone(data);
        await this.#writeOperations(this.#makeOperations(uid, previous, next));
        this.#cachedData.set(uid, next);
      });
    this.#queues.set(uid, nextQueue);
    return nextQueue.finally(() => {
      if (this.#queues.get(uid) === nextQueue) this.#queues.delete(uid);
    });
  }

  async flushUserWrites(uid) {
    await (this.#queues.get(uid) ?? Promise.resolve());
  }

  async importUserData(uid, data) {
    this.#cachedData.set(uid, emptyData());
    await this.saveUserData(uid, data);
  }
}

export const firestoreService = new FirestoreService();
export const loadUserData = (uid) => firestoreService.loadUserData(uid);
export const saveUserData = (uid, data) => firestoreService.saveUserData(uid, data);
export const flushUserWrites = (uid) => firestoreService.flushUserWrites(uid);
export const importUserData = (uid, data) => firestoreService.importUserData(uid, data);
