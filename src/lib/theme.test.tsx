import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, render } from "@testing-library/react";
import { ThemeProvider } from "./theme";

type Listener = () => void;

let systemDark = false;
const listeners = new Set<Listener>();
const originalMatchMedia = window.matchMedia;

function setSystemDark(dark: boolean) {
  systemDark = dark;
  for (const listener of listeners) listener();
}

function renderProvider() {
  return render(<ThemeProvider>{null}</ThemeProvider>);
}

function isDark() {
  return document.documentElement.classList.contains("dark");
}

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    media: query,
    get matches() {
      return query === "(prefers-color-scheme: dark)" && systemDark;
    },
    addEventListener: (_: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_: string, listener: Listener) => listeners.delete(listener),
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  listeners.clear();
  systemDark = false;
  document.documentElement.classList.remove("dark");
});

test("follows a system theme change while the page is open", () => {
  renderProvider();
  expect(isDark()).toBe(false);

  act(() => setSystemDark(true));

  expect(isDark()).toBe(true);
});

test("follows a system theme change made between visits", () => {
  renderProvider().unmount();

  systemDark = true;
  renderProvider();

  expect(isDark()).toBe(true);
});

test("ignores a theme pinned by an earlier version", () => {
  localStorage.setItem("journal-theme", "light");
  systemDark = true;

  renderProvider();

  expect(isDark()).toBe(true);
});
