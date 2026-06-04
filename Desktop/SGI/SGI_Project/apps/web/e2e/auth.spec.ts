import { test, expect } from "@playwright/test";
import { login } from "./helpers";

/**
 * Parcours d'authentification — valide la chaîne réelle navigateur → route handler
 * Next (/api/auth/login) → API FastAPI → cookie de session → coquille applicative.
 */
test.describe("Authentification", () => {
  test("connexion réussie → coquille applicative", async ({ page }) => {
    await login(page);
    // La sidebar (coquille) est rendue : présence d'au moins un item de navigation.
    await expect(page.getByTestId("nav-dash")).toBeVisible();
  });

  test("mauvais mot de passe → reste sur le login avec erreur", async ({ page }) => {
    await page.goto("/");
    const pwd = page.locator('input[type="password"]');
    await expect(pwd).toBeVisible();

    const loginForm = page.locator("form").filter({ has: pwd });
    await loginForm.locator('input[type="text"]').first().fill("admin@infinity-uae.com");
    await pwd.fill("mauvais-mot-de-passe");
    await loginForm.locator('button[type="submit"]').click();

    // On NE passe PAS : le champ mot de passe reste visible, pas de coquille applicative.
    await expect(pwd).toBeVisible();
    await expect(page.getByTestId("app-shell")).toHaveCount(0);
  });
});
