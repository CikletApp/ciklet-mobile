import type { SQLiteDatabase } from "expo-sqlite";

/**
 * Web: yerel veritabanı yok (expo-sqlite web derlemesi wasm ve COOP/COEP
 * başlıkları istiyor). Çağıranlar null'da yerelsiz çalışır — bkz. local-db.ts.
 */

export function localDb(): SQLiteDatabase | null {
  return null;
}

export function enqueueWrite(_task: (db: SQLiteDatabase) => Promise<void>): Promise<void> {
  return Promise.resolve();
}

export function kvGet<T>(_key: string): { value: T; updatedAt: number } | null {
  return null;
}

export function kvSet(_key: string, _value: unknown, _updatedAt?: number): Promise<void> {
  return Promise.resolve();
}

export function kvDelete(_key: string): Promise<void> {
  return Promise.resolve();
}

export async function messageStorageBytes(): Promise<number> {
  return 0;
}

export function wipeLocalDb(): Promise<void> {
  return Promise.resolve();
}
