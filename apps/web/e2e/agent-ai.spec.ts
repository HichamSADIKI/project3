import { test, expect } from "@playwright/test";

import { login, navigateTo } from "./helpers";

/**
 * Parcours **Agent AI** (Clients & Fournisseurs) — smoke de navigation + UI.
 *
 * On vérifie que les sous-catégories « Agent AI » se chargent, que le sélecteur
 * d'entité (recherche) est présent et que les onglets basculent. On n'exerce PAS
 * d'appel Gemini réel (réseau → instable) : c'est un filet contre les régressions
 * de routage / nav / onglets, pas un test du moteur IA.
 */
test.describe("Agent AI", () => {
  // La nav par défaut est « hub » (cartes, sans sidebar classique). Les helpers
  // navigateTo() pilotent la sidebar classique → on force ce mode avant le login.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("sgi_nav_mode", "classic"));
  });

  test("Clients · Agent AI — écran + recherche + onglets", async ({ page }) => {
    await login(page);
    await navigateTo(page, { key: "clients_ai", group: "clients" });

    await expect(page.getByTestId("screen-clients_ai")).toBeVisible();

    // Onglet Qualification → le sélecteur d'entité (recherche, plus d'UUID) apparaît.
    await page.getByTestId("aitab-entity").click();
    await expect(page.getByTestId("ai-entity-search")).toBeVisible();
    // Bascule vers Message → toujours présent.
    await page.getByTestId("aitab-message").click();
    await expect(page.getByTestId("ai-entity-search")).toBeVisible();
  });

  test("Fournisseurs · Agent AI — écran + onglets validation/message", async ({ page }) => {
    await login(page);
    await navigateTo(page, { key: "fournisseurs_ai", group: "fournisseurs" });

    await expect(page.getByTestId("screen-fournisseurs_ai")).toBeVisible();

    // Les fournisseurs ont l'onglet Validation (secondary) ET Message.
    await page.getByTestId("aitab-secondary").click();
    await expect(page.getByTestId("ai-entity-search")).toBeVisible();
    await page.getByTestId("aitab-message").click();
    await expect(page.getByTestId("ai-entity-search")).toBeVisible();
  });
});
