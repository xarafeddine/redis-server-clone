// utils/store.ts

export class RedisStore {
  private store: Map<string, string>;

  constructor() {
    this.store = new Map();
  }

  set(key: string, value: string): void {
    this.store.set(key, value);
  }

  get(key: string): string | undefined {
    return this.store.get(key);
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }
}
