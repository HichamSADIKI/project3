import { test, expect } from "@playwright/test";
import { login, navigateTo } from "./helpers";

/**
 * Parcours Immobilier · Location — symétrique de `immobilier-vente` : navigation
 * sidebar puis interrupteur **En ligne / Hors ligne** de publication vitrine (annonces
 * de location, `leasing/listings`). L'onglet « Annonces » est l'onglet par défaut.
 * Test idempotent : on bascule l'état réel via l'API puis on le restaure.
 */
test.describe("Immobilier · Location", () => {
  test("navigation sidebar → écran Location chargé", async ({ page }) => {
    await login(page);
    await navigateTo(page, { key: "realestate_location", group: "realestate", section: "commercial" });
    await expect(page.getByTestId("screen-realestate_location")).toBeVisible();
  });

  test("interrupteur En ligne/Hors ligne bascule l'état puis le restaure", async ({ page }) => {
    await login(page);
    await navigateTo(page, { key: "realestate_location", group: "realestate", section: "commercial" });

    // L'onglet Annonces est l'onglet par défaut : les interrupteurs y sont visibles.
    await page.getByTestId("tab-listings").click();

    const toggle = page.locator('[data-testid^="online-toggle-"]').first();
    await expect(toggle).toBeVisible();

    const before = await toggle.getAttribute("aria-pressed");
    await toggle.click();
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
