import { Entity } from "./Entity.js";

export class Category extends Entity {}
export class Property extends Entity {}
export class Unit extends Entity {}
export class Tenant extends Entity {}
export class Payment extends Entity {}
export class Invoice extends Entity {}
export class Expense extends Entity {}
export class Archive extends Entity {}

export const collectionModels = Object.freeze({
  categories: Category,
  properties: Property,
  units: Unit,
  tenants: Tenant,
  payments: Payment,
  invoices: Invoice,
  expenses: Expense,
  archives: Archive
});
