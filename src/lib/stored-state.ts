import { useState } from "react";

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export function useStoredState<T extends string>(key: string, fallback: T) {
  const [value, setValue] = useState(() => (read(key) as T | null) ?? fallback);
  const store = (next: T) => {
    write(key, next);
    setValue(next);
  };
  return [value, store] as const;
}
