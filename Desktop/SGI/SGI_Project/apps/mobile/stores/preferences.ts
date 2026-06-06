/**
 * Store Zustand — préférences de session SGI mobile.
 * Persiste pays + modules sélectionnés au login via expo-secure-store.
 * Le défaut = toutes les fonctionnalités système activées.
 */
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

export type CountryCode = "AE" | "SA" | "QA" | "FR" | "MA";
export type ModuleKey = "dashboard" | "properties" | "crm" | "clients" | "agenda" | "profile";

export const COUNTRIES: { code: CountryCode; flag: string; nameKey: string }[] = [
  { code: "AE", flag: "🇦🇪", nameKey: "country_ae" },
  { code: "SA", flag: "🇸🇦", nameKey: "country_sa" },
  { code: "QA", flag: "🇶🇦", nameKey: "country_qa" },
  { code: "FR", flag: "🇫🇷", nameKey: "country_fr" },
  { code: "MA", flag: "🇲🇦", nameKey: "country_ma" },
];

export const ALL_MODULES: ModuleKey[] = [
  "dashboard",
  "properties",
  "crm",
  "clients",
  "agenda",
  "profile",
];

export const SYSTEM_MODULES: ModuleKey[] = ["dashboard", "profile"];

export const DEFAULT_COUNTRY: CountryCode = "AE";
export const DEFAULT_MODULES: ModuleKey[] = [...ALL_MODULES];

/** Durée d'inactivité (minutes) avant déconnexion automatique. 0 = désactivé. */
export const INACTIVITY_TIMEOUT_OPTIONS_MIN = [1, 5, 15, 30, 60, 0] as const;
export type InactivityTimeoutMin = (typeof INACTIVITY_TIMEOUT_OPTIONS_MIN)[number];
export const DEFAULT_INACTIVITY_TIMEOUT_MIN: InactivityTimeoutMin = 15;

const KEY_COUNTRY = "sgi_pref_country";
const KEY_MODULES = "sgi_pref_modules";
const KEY_INACTIVITY = "sgi_pref_inactivity_min";

interface PreferencesState {
  country: CountryCode;
  modules: ModuleKey[];
  inactivityTimeoutMin: InactivityTimeoutMin;
  hydrated: boolean;

  setCountry: (c: CountryCode) => Promise<void>;
  toggleModule: (m: ModuleKey) => Promise<void>;
  setModules: (mods: ModuleKey[]) => Promise<void>;
  setInactivityTimeoutMin: (min: InactivityTimeoutMin) => Promise<void>;
  reset: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  country: DEFAULT_COUNTRY,
  modules: DEFAULT_MODULES,
  inactivityTimeoutMin: DEFAULT_INACTIVITY_TIMEOUT_MIN,
  hydrated: false,

  hydrate: async () => {
    try {
      const [c, m, t] = await Promise.all([
        SecureStore.getItemAsync(KEY_COUNTRY),
        SecureStore.getItemAsync(KEY_MODULES),
        SecureStore.getItemAsync(KEY_INACTIVITY),
      ]);
      const country = (c as CountryCode) || DEFAULT_COUNTRY;
      const modules = m ? (JSON.parse(m) as ModuleKey[]) : DEFAULT_MODULES;
      const parsed = t !== null ? Number(t) : NaN;
      const inactivityTimeoutMin = (
        INACTIVITY_TIMEOUT_OPTIONS_MIN as readonly number[]
      ).includes(parsed)
        ? (parsed as InactivityTimeoutMin)
        : DEFAULT_INACTIVITY_TIMEOUT_MIN;
      set({ country, modules, inactivityTimeoutMin, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  setCountry: async (country) => {
    await SecureStore.setItemAsync(KEY_COUNTRY, country);
    set({ country });
  },

  toggleModule: async (m) => {
    if (SYSTEM_MODULES.includes(m)) return;
    const cur = get().modules;
    const next = cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m];
    await SecureStore.setItemAsync(KEY_MODULES, JSON.stringify(next));
    set({ modules: next });
  },

  setModules: async (mods) => {
    const merged = Array.from(new Set([...SYSTEM_MODULES, ...mods]));
    await SecureStore.setItemAsync(KEY_MODULES, JSON.stringify(merged));
    set({ modules: merged });
  },

  setInactivityTimeoutMin: async (min) => {
    await SecureStore.setItemAsync(KEY_INACTIVITY, String(min));
    set({ inactivityTimeoutMin: min });
  },

  reset: async () => {
    await Promise.all([
      SecureStore.setItemAsync(KEY_COUNTRY, DEFAULT_COUNTRY),
      SecureStore.setItemAsync(KEY_MODULES, JSON.stringify(DEFAULT_MODULES)),
      SecureStore.setItemAsync(KEY_INACTIVITY, String(DEFAULT_INACTIVITY_TIMEOUT_MIN)),
    ]);
    set({
      country: DEFAULT_COUNTRY,
      modules: DEFAULT_MODULES,
      inactivityTimeoutMin: DEFAULT_INACTIVITY_TIMEOUT_MIN,
    });
  },
}));
