export class Entity {
  #attributes;

  constructor(attributes = {}) {
    this.#attributes = structuredClone(attributes);
  }

  get id() {
    return this.#attributes.id;
  }

  get(name) {
    return this.#attributes[name];
  }

  toJSON() {
    return structuredClone(this.#attributes);
  }

  toFirestore() {
    return this.toJSON();
  }

  static fromFirestore(id, data) {
    return new this({ ...data, id });
  }
}
