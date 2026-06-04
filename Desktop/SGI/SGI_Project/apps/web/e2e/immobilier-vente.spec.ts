import { test, expect } from "@playwright/test";
import { login, navigateTo } from "./helpers";

/**
 * Parcours Immobilier · Vente — navigation sidebar (groupe + rubrique repliables)
 * puis l'interrupteur **En ligne / Hors ligne** de publication vitrine (fonctionnalité
 * livrée) : on vérifie que l'état réel bascule via l'API, puis on le restaure
 * (test idempotent — il ne laisse pas la donnée modifiée).
 */
test.describe("Immobilier · Vente", () => {
  test("navigation sidebar → écran Vente chargé", async ({ page }) => {
    await login(page);
    await navigateTo(page, { key: "realestate_vente", group: "realestate", section: "commercial" });
    await expect(page.getByTestId("screen-realestate_vente")).toBeVisible();
  });

  test("interrupteur En ligne/Hors ligne bascule l'état puis le restaure", async ({ page }) => {
    await login(page);
    await navigateTo(page, { key: "realestate_vente", group: "realestate", section: "commercial" });

    // Onglet Annonces (les interrupteurs de publication y vivent).
    await page.getByTestId("tab-listings").click();

    const toggle = page.locator('[data-testid^="online-toggle-"]').first();
    await expect(toggle).toBeVisible();

    const before = await toggle.getAttribute("aria-pressed");
    await toggle.click();
    // Après la transition + rechargement de la liste, l'état doit avoir basculé.
    const flipped = before === "true" ? "false" : "true";
    await expect(page.locator('[data-testid^="online-toggle-"]').first()).toHaveAttribute(
      "aria-pressed",
      flipped,
    );

    // Restauration : on rebascule pour ne pas laisser la donnée modifiée.
    await page.locator('[data-testid^="online-toggle-"]').first().click();
    await expect(page.locator('[data-testid^="online-toggle-"]').first()).toHaveAttribute(
      "aria-pressed",
      before ?? "false",
    );
  });
});
