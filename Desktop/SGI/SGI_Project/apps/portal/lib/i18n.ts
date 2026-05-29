/**
 * SGI Portal — i18n minimaliste (server-side).
 * Recharge les bundles depuis @sgi/i18n et expose `t(key)` par namespace.
 */
import { bundles, type Locale, type Namespace, isRTL } from "@sgi/i18n";

export const LOCALES = ["ar", "en", "fr"] as const;
export type { Locale, Namespace };
export { isRTL };

type Bundle = Record<string, unknown>;

function resolve(obj: Bundle, key: string): string | undefined {
  return key.split(".").reduce<unknown>(
    (acc, part) =>
      acc && typeof acc === "object" ? (acc as Bundle)[part] : undefined,
    obj,
  ) as string | undefined;
}

export function getDictionary(ns: Namespace, locale: Locale): Bundle {
  return (bundles[ns][locale] ?? bundles[ns].en) as Bundle;
}

export function makeT(ns: Namespace, locale: Locale) {
  const dict = getDictionary(ns, locale);
  return (key: string, vars?: Record<string, string | number>): string => {
    let value = resolve(dict, key) ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        value = value.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "g"), String(v));
      }
    }
    return value;
  };
}

export function dirFor(locale: Locale): "ltr" | "rtl" {
  return isRTL(locale) ? "rtl" : "ltr";
}

export function isValidLocale(s: string): s is Locale {
  return (LOCALES as readonly string[]).includes(s);
}
