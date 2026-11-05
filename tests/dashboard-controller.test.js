import test from "node:test";
import assert from "node:assert/strict";
import { DashboardController } from "../src/controllers/dashboard-controller.js";

test("Firestore permission errors are surfaced without importing local data or readying a session", async () => {
  const calls = [];
  const permissionError = Object.assign(new Error("Missing or insufficient permissions."), {
    code: "permission-denied"
  });
  const databaseService = {
    getLegacyData: () => ({}),
    setUserStorageScope: (uid) => calls.push(["scope", uid]),
    replaceAll: () => calls.push(["replace"]),
    setCloudSync: () => calls.push(["sync"])
  };
  const firestoreService = {
    loadUserData: async (...args) => {
      calls.push(["load", ...args]);
      throw permissionError;
    },
    importUserData: async () => calls.push(["import"])
  };
  const controller = new DashboardController({
    authService: {},
    databaseService,
    firestoreService,
    confirmLocalImport: async () => true,
    onLoading: () => calls.push(["loading"]),
    onReady: () => calls.push(["ready"]),
    onError: (error) => calls.push(["error", error]),
    onSyncError: () => {},
    onUnauthenticated: () => calls.push(["unauthenticated"])
  });

  await controller.initializeAuthenticatedSession({
    uid: "owner-1",
    email: "owner@example.test",
    displayName: "Owner"
  });

  assert.deepEqual(calls, [
    ["loading"],
    ["scope", "owner-1"],
    ["load", "owner-1", { email: "owner@example.test", displayName: "Owner" }],
    ["scope", null],
    ["error", permissionError]
  ]);
});
