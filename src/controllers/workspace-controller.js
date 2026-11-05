export class WorkspaceController {
  #databaseService;

  constructor(databaseService) {
    this.#databaseService = databaseService;
  }

  getAll() {
    return this.#databaseService.getAll();
  }

  getById(collection, id) {
    return this.#databaseService.getById(collection, id);
  }

  setDateMode(...args) {
    return this.#databaseService.setDateMode(...args);
  }

  resetDateMode() {
    return this.#databaseService.resetDateMode();
  }

  createCategory(...args) {
    return this.#databaseService.createCategory(...args);
  }

  deleteCategory(...args) {
    return this.#databaseService.deleteCategory(...args);
  }

  createProperty(...args) {
    return this.#databaseService.createProperty(...args);
  }

  deleteProperty(...args) {
    return this.#databaseService.deleteProperty(...args);
  }

  createUnit(...args) {
    return this.#databaseService.createUnit(...args);
  }

  updateUnit(...args) {
    return this.#databaseService.updateUnit(...args);
  }

  deleteUnit(...args) {
    return this.#databaseService.deleteUnit(...args);
  }

  createTenant(...args) {
    return this.#databaseService.createTenant(...args);
  }

  updateTenant(...args) {
    return this.#databaseService.updateTenant(...args);
  }

  removeTenant(...args) {
    return this.#databaseService.removeTenant(...args);
  }

  cancelRental(...args) {
    return this.#databaseService.cancelRental(...args);
  }

  markPaymentPaid(...args) {
    return this.#databaseService.markPaymentPaid(...args);
  }

  cancelPayment(...args) {
    return this.#databaseService.cancelPayment(...args);
  }

  createExpense(...args) {
    return this.#databaseService.createExpense(...args);
  }

  archiveAnnualReport(...args) {
    return this.#databaseService.archiveAnnualReport(...args);
  }

  closeAnnualBooks(...args) {
    return this.#databaseService.closeAnnualBooks(...args);
  }

  deleteArchiveReport(...args) {
    return this.#databaseService.deleteArchiveReport(...args);
  }
}
