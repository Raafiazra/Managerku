export class DashboardController {
  #authService;
  #databaseService;
  #firestoreService;
  #confirmLocalImport;
  #onLoading;
  #onReady;
  #onError;
  #onSyncError;
  #onUnauthenticated;
  #generation = 0;

  constructor({
    authService,
    databaseService,
    firestoreService,
    confirmLocalImport,
    onLoading,
    onReady,
    onError,
    onSyncError,
    onUnauthenticated
  }) {
    this.#authService = authService;
    this.#databaseService = databaseService;
    this.#firestoreService = firestoreService;
    this.#confirmLocalImport = confirmLocalImport;
    this.#onLoading = onLoading;
    this.#onReady = onReady;
    this.#onError = onError;
    this.#onSyncError = onSyncError;
    this.#onUnauthenticated = onUnauthenticated;
  }

  observeAuthentication() {
    return this.#authService.observeState((user) => {
      if (user) {
        void this.initializeAuthenticatedSession(user);
        return;
      }

      this.#generation += 1;
      this.#onUnauthenticated();
    });
  }

  async initializeAuthenticatedSession(user) {
    const generation = ++this.#generation;
    this.#onLoading(user);

    try {
      const legacyData = this.#databaseService.getLegacyData();
      this.#databaseService.setUserStorageScope(user.uid);
      const cloud = await this.#firestoreService.loadUserData(user.uid, {
        email: user.email,
        displayName: user.displayName
      });
      if (generation !== this.#generation) return;

      let accountData = cloud.data;
      const hasLocalBusinessData = [
        "categories", "properties", "units", "tenants", "expenses", "payments", "invoices", "archives"
      ].some((key) => legacyData[key]?.length > 0);
      if (!cloud.hasRecords && hasLocalBusinessData && await this.#confirmLocalImport()) {
        await this.#firestoreService.importUserData(user.uid, legacyData);
        accountData = legacyData;
      }

      if (generation !== this.#generation) return;
      this.#databaseService.replaceAll(accountData);
      this.#databaseService.setCloudSync(
        user.uid,
        (uid, data) => this.#firestoreService.saveUserData(uid, data),
        this.#onSyncError
      );
      this.#onReady(user);
    } catch (error) {
      if (generation !== this.#generation) return;
      this.#databaseService.setUserStorageScope(null);
      this.#onError(error);
    }
  }
}
