"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Mode    = "dark" | "light";
export type Palette =
  | "slate" | "gold" | "midnight" | "sage"
  | "instagram" | "snapchat" | "facebook";

export interface ThemeCtx {
  theme:      Mode;
  palette:    Palette;
  toggle:     () => void;
  setPalette: (p: Palette) => void;
}

const ThemeContext = createContext<ThemeCtx>({
  theme: "dark", palette: "slate",
  toggle: () => {}, setPalette: () => {},
});

const PALETTE_CLASSES: Palette[] = [
  "slate", "gold", "midnight", "sage",
  "instagram", "snapchat", "facebook",
];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme,   setTheme]   = useState<Mode>("dark");
  const [palette, setPal]     = useState<Palette>("slate");

  useEffect(() => {
    const savedMode    = localStorage.getItem("sgi-theme")    as Mode    | null;
    const savedPalette = localStorage.getItem("sgi-palette")  as Palette | null;
    const mode = savedMode    ?? "dark";
    const pal  = savedPalette ?? "slate";
    setTheme(mode);
    setPal(pal);
    applyClasses(mode, pal);
  }, []);

  function applyClasses(mode: Mode, pal: Palette) {
    const cl = document.documentElement.classList;
    cl.toggle("dark", mode === "dark");
    PALETTE_CLASSES.forEach(p => cl.remove(`theme-${p}`));
    cl.add(`theme-${pal}`);
  }

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("sgi-theme", next);
    applyClasses(next, palette);
  };

  const setPalette = (p: Palette) => {
    setPal(p);
    localStorage.setItem("sgi-palette", p);
    applyClasses(theme, p);
  };

  return (
    <ThemeContext.Provider value={{ theme, palette, toggle, setPalette }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
