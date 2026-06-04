import { test, expect } from "@playwright/test";
import { login } from "./helpers";

/**
 * Isolation multi-tenant (Loi 1) au niveau de la frontière proxy Next → API.
 *
 * Contrat documenté (anti-BOLA) : une ressource non possédée par le tenant courant
 * renvoie **404** (jamais 200, jamais 403). Et toute requête sans session est **401**
 * (garde du middleware Edge). On vérifie les deux depuis le contexte navigateur.
 */
test.describe("Isolation tenant (Loi 1)", () => {
  test("annonce d'un id forgé / non possédé → 404 (jamais 200/403)", async ({ page }) => {
    await login(page); // le contexte porte alors le cookie de session

    const forged = "00000000-0000-4000-8000-000000000000";
    const res = await page.request.get(`/api/admin/sales/listings/${forged}`);
    expect(res.status()).toBe(404);
  });

  test("accès sans session → 401", async ({ request }) => {
    // Le fixture `request` est un contexte indépendant, sans cookie de session.
    const res = await request.get("/api/admin/sales/listings");
    expect(res.status()).toBe(401);
  });
});
