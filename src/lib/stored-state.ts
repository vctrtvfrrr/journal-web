import { useState } from "react";

type StoredKey =
  | "journal-notebook"
  | "journal-home-view"
  | `journal-layout:${string}`
  | `journal-collapsed:${string}`;

export const safeLocalStorage = {
  getItem(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
};

export function useStoredState<T extends string>(key: StoredKey, fallback: T) {
  const [value, setValue] = useState(() => (safeLocalStorage.getItem(key) as T | null) ?? fallback);
  const store = (next: T) => {
    safeLocalStorage.setItem(key, next);
    setValue(next);
  };
  return [value, store] as const;
}

export function useStoredSet(key: StoredKey) {
  const [stored, store] = useStoredState<string>(key, "");
  const members = new Set(stored.split(",").filter(Boolean));
  const setMember = (member: string, present: boolean) => {
    const next = new Set(members);
    if (present) next.add(member);
    else next.delete(member);
    store([...next].join(","));
  };
  return [members, setMember] as const;
}
