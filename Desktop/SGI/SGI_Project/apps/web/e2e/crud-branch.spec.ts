import { test, expect } from "@playwright/test";
import { login, navigateTo } from "./helpers";

/**
 * Parcours d'écriture (CRUD) — création d'une Succursale via le formulaire, POST
 * réel vers l'API, puis vérification que la nouvelle ligne apparaît dans la liste
 * (rechargement). Le nom est unique (timestamp) pour rester sans collision entre runs.
 */
test.describe("Immobilier · Succursales (CRUD)", () => {
  test("création d'une succursale → apparaît dans la liste", async ({ page }) => {
    await login(page);
    await navigateTo(page, { key: "realestate_branches", group: "realestate", section: "patrimoine" });
    await expect(page.getByTestId("screen-realestate_branches")).toBeVisible();

    const name = `E2E Succursale ${Date.now()}`;
    await page.getByTestId("branch-add").click();
    await page.getByTestId("branch-name").fill(name);
    await page.getByTestId("branch-submit").click();

    // La modale se ferme et la nouvelle succursale figure dans le tableau.
    await expect(page.getByText(name)).toBeVisible();
  });
});
