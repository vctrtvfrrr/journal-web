import { useState } from "react";

function read(key: StoredKey) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: StoredKey, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

type StoredKey = "journal-notebook" | "journal-home-view";

export function useStoredState<T extends string>(key: StoredKey, fallback: T) {
  const [value, setValue] = useState(() => (read(key) as T | null) ?? fallback);
  const store = (next: T) => {
    write(key, next);
    setValue(next);
  };
  return [value, store] as const;
}
