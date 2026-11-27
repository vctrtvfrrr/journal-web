import * as React from "react";
import { useMediaQuery } from "./use-media-query";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  crt: boolean;
  setCrt: (crt: boolean) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme: Theme = useMediaQuery("(prefers-color-scheme: dark)") ? "dark" : "light";
  const [crt, setCrt] = React.useState(false);

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#0b0e14" : "#f8f9fa");
  }, [theme]);

  React.useEffect(() => {
    document.body.classList.toggle("crt", crt);
  }, [crt]);

  const value = React.useMemo<ThemeContextValue>(() => ({ theme, crt, setCrt }), [theme, crt]);

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

function useTheme() {
  const context = React.use(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

export { ThemeProvider, useTheme, type Theme };
