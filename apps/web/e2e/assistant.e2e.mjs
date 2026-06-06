/**
 * E2E de l'assistant in-app (robot vivant & mobile).
 *
 * Couvre : présence de l'avatar, glisser-déposer (repositionnement), clic qui
 * déclenche la mise en scène (se lève → marche au centre → demande → ouvre le
 * chat), chat en streaming + bouton pré-remplir, et transformation en ambulance
 * sur événement de secours.
 *
 * Robuste : attentes par CONDITION (waitForFunction / waitFor) plutôt que des
 * `waitForTimeout` fixes — tolère la séquence d'ouverture différée (~3 s).
 *
 * Utilise la lib `playwright` (le runner @playwright/test n'est pas installé).
 * Lancer le web d'abord (docker), puis :
 *   node e2e/assistant.e2e.mjs            # ou: pnpm --filter sgi-web e2e:assistant
 * E2E_BASE_URL surcharge l'URL (défaut http://localhost:5001).
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:5001";
let failed = false;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 850 } });

async function check(name, fn) {
  try {
    await fn();
    console.log("  ✓", name);
  } catch (e) {
    failed = true;
    console.error("  ✗", name, "—", e.message);
  }
}

/** Clique l'avatar en son centre actuel (sa position varie : il se déplace). */
async function clickAvatar() {
  const a = await page.getByTestId("assistant-avatar").boundingBox();
  await page.mouse.click(a.x + a.width / 2, a.y + a.height / 2);
}

/** Vrai si le panneau de chat est ouvert. */
const chatOpen = () => page.locator("[data-assistant-ui]").count().then((n) => n >= 1);

try {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  await page.locator("form input:not([type=password])").first().fill("admin@sgi.ae");
  await page.locator('form input[type="password"]').first().fill("Admin12345!");
  await page.locator('form button[type="submit"]').first().click();

  const avatar = page.getByTestId("assistant-avatar");
  // Login OK = l'avatar apparaît (condition, pas un sleep).
  await avatar.first().waitFor({ state: "visible", timeout: 20000 });

  await check("avatar (robot) présent", async () => {
    assert.equal(await avatar.count(), 1);
  });

  await check("emblème de marque + casque téléphone présents", async () => {
    assert.ok((await page.locator(".sgia-emblem").count()) >= 1, "emblème robot");
    assert.ok((await page.locator(".sgph-headset").count()) >= 1, "casque téléphone");
  });

  await check("glisser-déposer repositionne le robot", async () => {
    const before = await avatar.boundingBox();
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await page.mouse.down();
    await page.mouse.move(700, 400, { steps: 12 });
    await page.mouse.up();
    await page.waitForFunction(
      (x0) => {
        const el = document.querySelector('[data-testid="assistant-avatar"]');
        const r = el?.getBoundingClientRect();
        return r && Math.abs(r.x - x0) > 100;
      },
      before.x,
      { timeout: 4000 },
    );
  });

  await check("clic déclenche la mise en scène puis ouvre le chat", async () => {
    assert.equal(await chatOpen(), false, "chat fermé au départ");
    await clickAvatar();
    // La séquence (lève → centre → demande → ouvre) ouvre le chat sous ~3 s.
    await page.locator("[data-assistant-ui]").first().waitFor({ state: "visible", timeout: 8000 });
  });

  await check("chat en streaming + bouton pré-remplir (action guidée)", async () => {
    if (!(await chatOpen())) {
      await clickAvatar();
      await page.locator("[data-assistant-ui]").first().waitFor({ state: "visible", timeout: 8000 });
    }
    const ta = page.locator("[data-assistant-ui] textarea").first();
    await ta.fill("créer un prospect, villa à Dubai Marina, budget 2.5M");
    await ta.press("Enter");
    // Le flux SSE remplit une bulle assistant (repli déterministe en dev).
    await page.waitForFunction(
      () => {
        const el = document.querySelector("[data-assistant-ui]");
        const t = el ? el.innerText : "";
        return /assistant SGI|SGI assistant|مساعد/i.test(t) && /remplir|pre-fill|النموذج/i.test(t);
      },
      undefined,
      { timeout: 15000 },
    );
  });

  await check("transformation en ambulance sur secours", async () => {
    // Fermer le chat (priorité parked > rescue) puis déclencher un secours.
    if (await chatOpen()) {
      await clickAvatar();
      await page.waitForFunction(
        () => document.querySelectorAll("[data-assistant-ui]").length === 0,
        undefined,
        { timeout: 5000 },
      );
    }
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("sgi:assistant", { detail: { type: "rescue" } })),
    );
    await page.locator(".sgia-amb").first().waitFor({ state: "attached", timeout: 4000 });
  });
} catch (e) {
  console.error("FATAL:", e.message);
  failed = true;
} finally {
  await browser.close();
}

console.log(failed ? "\nE2E assistant: ÉCHEC" : "\nE2E assistant: OK");
process.exit(failed ? 1 : 0);
