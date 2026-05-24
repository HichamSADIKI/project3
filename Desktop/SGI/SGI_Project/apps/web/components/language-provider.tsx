"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { T, type Lang, type Translations } from "@/lib/i18n";

type LangCtx = { lang: Lang; setLang: (l: Lang) => void };

const LangContext = createContext<LangCtx>({ lang: "en", setLang: () => {} });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);
  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLang(): LangCtx {
  return useContext(LangContext);
}

export function useT(): Translations {
  const { lang } = useLang();
  return T[lang];
}
