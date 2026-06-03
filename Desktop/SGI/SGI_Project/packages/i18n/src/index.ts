/**
 * SGI — Bundles i18n centralisés (AR/EN/FR).
 * Charger par namespace : "common" (chrome/auth/home), "client" (espace Client),
 * "fournisseur" (espace Fournisseur).
 */

import clientFr from "../locales/fr/client.json";
import clientEn from "../locales/en/client.json";
import clientAr from "../locales/ar/client.json";
import fournisseurFr from "../locales/fr/fournisseur.json";
import fournisseurEn from "../locales/en/fournisseur.json";
import fournisseurAr from "../locales/ar/fournisseur.json";
import commonFr from "../locales/fr/common.json";
import commonEn from "../locales/en/common.json";
import commonAr from "../locales/ar/common.json";
import ownerFr from "../locales/fr/owner.json";
import ownerEn from "../locales/en/owner.json";
import ownerAr from "../locales/ar/owner.json";
import tenantFr from "../locales/fr/tenant.json";
import tenantEn from "../locales/en/tenant.json";
import tenantAr from "../locales/ar/tenant.json";
import realestateFr from "../locales/fr/realestate.json";
import realestateEn from "../locales/en/realestate.json";
import realestateAr from "../locales/ar/realestate.json";

export const SUPPORTED_LOCALES = ["ar", "en", "fr"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ar";
export const RTL_LOCALES: readonly Locale[] = ["ar"] as const;

export const bundles = {
  common: { ar: commonAr, en: commonEn, fr: commonFr },
  client: { ar: clientAr, en: clientEn, fr: clientFr },
  fournisseur: { ar: fournisseurAr, en: fournisseurEn, fr: fournisseurFr },
  owner: { ar: ownerAr, en: ownerEn, fr: ownerFr },
  tenant: { ar: tenantAr, en: tenantEn, fr: tenantFr },
  realestate: { ar: realestateAr, en: realestateEn, fr: realestateFr },
} as const;

export type Namespace = keyof typeof bundles;

export function isRTL(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}
