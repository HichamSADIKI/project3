"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Mode = "light" | "dark";

interface ThemeCtx {
  theme: Mode;
  toggle: () => void;
  setTheme: (m: Mode) => void;
}

const ThemeContext = createContext<ThemeCtx>({
  theme: "light",
  toggle: () => {},
  setTheme: () => {},
});

const STORAGE_KEY = "sgi-portal-theme";

function applyMode(mode: Mode) {
  const cl = document.documentElement.classList;
  cl.toggle("dark", mode === "dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Mode>("light");

  useEffect(() => {
    const saved = (typeof window !== "undefined"
      ? (localStorage.getItem(STORAGE_KEY) as Mode | null)
      : null);
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const initial: Mode = saved ?? (prefersDark ? "dark" : "light");
    setThemeState(initial);
    applyMode(initial);
  }, []);

  function setTheme(mode: Mode) {
    setThemeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    applyMode(mode);
  }

  function toggle() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeCtx {
  return useContext(ThemeContext);
}
