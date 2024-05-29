import { StoreValue } from "./types";

export class RedisStore {
  private store: Map<string, StoreValue>;

  constructor(initStore?: [string, StoreValue][]) {
    this.store = new Map(initStore);
  }

  set(key: string, value: StoreValue): void {
    this.store.set(key, value);
  }

  get(key: string): StoreValue | undefined {
    return this.store.get(key);
  }
  getKeys() {
    return Array.from(this.store.keys());
  }

  getEntries() {
    return Array.from(this.store.entries());
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }
}
