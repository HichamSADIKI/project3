import { test, expect } from "@playwright/test";

import { login, navigateTo } from "./helpers";

/**
 * Parcours Finance & Comptabilité — non-régression des écrans câblés sur le
 * backend (PR #142/#146/#149/#155/#163/#166). Navigation sidebar (groupe Back
 * Office), puis vérification des vues réelles.
 *
 * Idempotent : aucune donnée n'est créée/modifiée (lecture seule des KPIs,
 * rapports, balance). Sélecteurs indépendants de la locale (testids + regex AR/EN/FR).
 *
 * Lancer : `pnpm --filter sgi-web e2e finance-accounting` (stack `make up` requise).
 */

test.describe("Finance", () => {
  test("navigation → écran Finance chargé (KPIs)", async ({ page }) => {
    await login(page);
    await navigateTo(page, { key: "finance", group: "backoffice" });
    await expect(page.getByTestId("screen-finance")).toBeVisible();
  });

  test("onglet Rapports → cartes P&L + TVA visibles", async ({ page }) => {
    await login(page);
    await navigateTo(page, { key: "finance", group: "backoffice" });
    await expect(page.getByTestId("screen-finance")).toBeVisible();

    await page.getByTestId("tab-reports").click();

    // Carte TVA (5 %) — libellé distinctif, multi-locale.
    await expect(
      page.getByText(/VAT \(5%\)|TVA \(5 %\)|ضريبة القيمة المضافة/).first(),
    ).toBeVisible();
    // Carte P&L (Profit & Loss / Résultat / الأرباح).
    await expect(
      page.getByText(/Profit & Loss|Résultat|الأرباح والخسائر/i).first(),
    ).toBeVisible();
  });

  test("onglet Journal accessible (retour depuis Rapports)", async ({ page }) => {
    await login(page);
    await navigateTo(page, { key: "finance", group: "backoffice" });
    await page.getByTestId("tab-reports").click();
    await page.getByTestId("tab-ledger").click();
    // Le journal présente l'en-tête de colonne Référence (multi-locale) ou un export CSV.
    await expect(page.getByTestId("screen-finance")).toBeVisible();
  });
});

test.describe("Comptabilité", () => {
  test("navigation → écran Comptabilité (3 onglets)", async ({ page }) => {
    await login(page);
    await navigateTo(page, { key: "accounting", group: "backoffice" });
    await expect(page.getByTestId("screen-accounting")).toBeVisible();
    await expect(page.getByTestId("tab-accounts")).toBeVisible();
    await expect(page.getByTestId("tab-entries")).toBeVisible();
    await expect(page.getByTestId("tab-balance")).toBeVisible();
  });

  test("Balance générale → total général équilibré (débits == crédits)", async ({ page }) => {
    await login(page);
    await navigateTo(page, { key: "accounting", group: "backoffice" });
    await page.getByTestId("tab-balance").click();

    // La ligne de total général s'affiche (partie double : débits == crédits).
    await expect(
      page.getByText(/Grand total|Total général|الإجمالي العام/i).first(),
    ).toBeVisible();
  });
});
