/**
 * E2E de l'assistant in-app (robot vivant & mobile).
 *
 * Couvre : présence de l'avatar, glisser-déposer (repositionnement), clic qui
 * ouvre le chat, transformation en ambulance sur événement de secours, et
 * emblème de marque + casque téléphone présents.
 *
 * Utilise la lib `playwright` (le runner @playwright/test n'est pas installé
 * dans ce workspace). Lancer le web d'abord (docker), puis :
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

try {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  await page.locator("form input:not([type=password])").first().fill("admin@sgi.ae");
  await page.locator('form input[type="password"]').first().fill("Admin12345!");
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForTimeout(3500);

  const avatar = page.getByTestId("assistant-avatar");

  await check("avatar (robot) présent", async () => {
    assert.equal(await avatar.count(), 1);
  });

  await check("emblème de marque + casque téléphone présents", async () => {
    assert.ok((await page.locator(".sgia-emblem").count()) >= 1, "emblème robot");
    assert.ok((await page.locator(".sgph-headset").count()) >= 1, "casque téléphone");
  });

  await check("glisser-déposer repositionne le robot", async () => {
    const before = await avatar.boundingBox();
    await page.mouse.move(before.x + 29, before.y + 30);
    await page.mouse.down();
    await page.mouse.move(700, 400, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    const after = await avatar.boundingBox();
    assert.ok(Math.abs(after.x - before.x) > 100, "le robot doit s'être déplacé");
  });

  await check("clic ouvre le panneau de chat", async () => {
    const a = await avatar.boundingBox();
    await page.mouse.click(a.x + 29, a.y + 30);
    await page.waitForTimeout(350);
    assert.equal(await page.locator("[data-assistant-ui]").count(), 1);
  });

  await check("transformation en ambulance sur secours", async () => {
    // Fermer le chat (priorité parked > rescue) puis déclencher un secours.
    const a = await avatar.boundingBox();
    await page.mouse.click(a.x + 29, a.y + 30);
    await page.waitForTimeout(250);
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("sgi:assistant", { detail: { type: "rescue" } })),
    );
    await page.waitForTimeout(500);
    assert.ok((await page.locator(".sgia-amb").count()) >= 1, "figure ambulance attendue");
  });
} catch (e) {
  console.error("FATAL:", e.message);
  failed = true;
} finally {
  await browser.close();
}

console.log(failed ? "\nE2E assistant: ÉCHEC" : "\nE2E assistant: OK");
process.exit(failed ? 1 : 0);
