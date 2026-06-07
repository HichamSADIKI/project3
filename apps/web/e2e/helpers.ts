import { Page, expect } from "@playwright/test";

/**
 * Connexion au back-office. Le formulaire de login est pré-rempli avec le compte
 * de démo (`admin@infinity-uae.com` / `Admin123!`, cf. seed.py) ; on resaisit
 * néanmoins explicitement pour rester déterministe quel que soit l'env.
 *
 * Sélecteurs indépendants de la locale (AR/EN/FR) : on cible par type d'input et
 * par le bouton de soumission, pas par le texte traduit.
 */
export async function login(
  page: Page,
  email = "admin@infinity-uae.com",
  password = "Admin123!",
): Promise<void> {
  await page.goto("/");

  const pwd = page.locator('input[type="password"]');
  await expect(pwd).toBeVisible();

  // Le 1er champ texte du formulaire de login = identifiant.
  const loginForm = page.locator("form").filter({ has: pwd });
  await loginForm.locator('input[type="text"]').first().fill(email);
  await pwd.fill(password);

  await loginForm.locator('button[type="submit"]').click();

  // Après login : l'écran login disparaît, la coquille applicative (sidebar) apparaît.
  await expect(pwd).toBeHidden();
  await expect(page.getByTestId("app-shell")).toBeVisible();
}

/**
 * Navigue vers un écran via la sidebar. Elle est repliable à 2 niveaux (groupe puis
 * rubrique/section) ; quand un niveau est replié, ses enfants restent dans le DOM
 * mais sont clippés — `isVisible()` n'est donc PAS fiable. On pilote l'ouverture sur
 * `aria-expanded` (header de groupe et de section), puis on clique l'item.
 */
export async function navigateTo(
  page: Page,
  opts: { key: string; group?: string; section?: string },
): Promise<void> {
  if (opts.group) {
    const group = page.getByTestId(`navgroup-${opts.group}`);
    if ((await group.getAttribute("aria-expanded")) === "false") await group.click();
  }
  if (opts.section) {
    const section = page.getByTestId(`navsection-${opts.section}`);
    if ((await section.getAttribute("aria-expanded")) === "false") await section.click();
  }
  await page.getByTestId(`nav-${opts.key}`).click();
}

