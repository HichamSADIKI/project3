import { defineConfig, devices } from "@playwright/test";

/**
 * E2E Playwright — smoke des parcours critiques du back-office SGI.
 *
 * Cible la stack Docker locale déjà démarrée (`make up`), web sur :5001, API sur :8000.
 * Le back-office est une SPA pilotée par état (un seul route `/`) : la navigation se
 * fait par clics dans la sidebar, pas par URLs. Chaque test passe par le formulaire
 * de login (l'app démarre toujours sur l'écran login, sans restauration de session).
 *
 * Lancer : `pnpm --filter sgi-web e2e` (stack up requise).
 * Surcharger la cible : E2E_BASE_URL=http://localhost:5001
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:5001";

export default defineConfig({
  testDir: "./e2e",
  // Hors CI par défaut : la CI GitHub n'a pas la stack complète (API/DB/MinIO).
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "fr-FR",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
