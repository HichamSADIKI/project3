import { test, expect } from "@playwright/test";
import { login, navigateTo } from "./helpers";

/**
 * Scénario vidéo social media — UI du générateur (popup depuis une annonce Vente) :
 * upload de photos + choix d'avatar voix (Homme/Femme) + bouton Générer.
 *
 * On valide le câblage de la fonctionnalité sans déclencher la génération réelle
 * (asynchrone Celery + FFmpeg + MinIO) : le rendu vidéo de bout en bout (#125)
 * est vérifié séparément. Le bouton Générer reste désactivé tant qu'aucune photo
 * n'est ajoutée — c'est l'invariant qu'on contrôle ici.
 */
test.describe("Scénario vidéo", () => {
  test("popup générateur : avatars Homme/Femme + générer désactivé à vide", async ({ page }) => {
    await login(page);
    await navigateTo(page, { key: "realestate_vente", group: "realestate", section: "commercial" });
    await page.getByTestId("tab-listings").click();

    // Ouvre le générateur de scénario de la première annonce.
    await page.getByTestId("scenario-open").first().click();
    await expect(page.getByTestId("scenario-dialog")).toBeVisible();

    // Choix d'avatar voix : Homme et Femme présents (fonctionnalité demandée).
    const male = page.getByTestId("avatar-male");
    const female = page.getByTestId("avatar-female");
    await expect(male).toBeVisible();
    await expect(female).toBeVisible();

    // Sélection de l'avatar Homme → état pressé reflété.
    await male.click();
    await expect(male).toHaveAttribute("aria-pressed", "true");
    await expect(female).toHaveAttribute("aria-pressed", "false");

    // Sans photo, la génération est interdite (invariant canGenerate).
    await expect(page.getByTestId("scenario-generate")).toBeDisabled();
  });
});
