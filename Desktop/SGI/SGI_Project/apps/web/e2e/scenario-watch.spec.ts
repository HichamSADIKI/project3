import { test, expect } from "@playwright/test";

/**
 * Scénario · lecture vidéo **durable** (régression #125 + #136).
 *
 * Valide de bout en bout, dans un contexte navigateur, que le lien « Voir » d'un
 * scénario *ready* fonctionne réellement :
 *  - l'API re-signe l'URL vidéo à CHAQUE lecture (`scenario_to_out`) → jamais périmée (#136) ;
 *  - la présignature vise l'endpoint **public** (`MINIO_PUBLIC_ENDPOINT`, :9000) joignable
 *    par le navigateur, pas l'hôte Docker interne (#125) ;
 *  - l'URL renvoie bien la vidéo (`200 video/mp4`).
 *
 * Pré-requis : un scénario seedé avec un vrai objet MinIO + `video_object_key` —
 * `docker compose exec -T api uv run python - < scripts/seed_ready_scenario_video.py`.
 *
 * Niveau API (contexte `request` de Playwright) : indépendant du DOM et de la locale.
 */
const E2E_TITLE = "E2E — vidéo MinIO durable";

type Scenario = { title?: string; status: string; video_url: string | null };

test.describe("Scénario · lecture vidéo durable (#125/#136)", () => {
  test("l'URL présignée d'un scénario ready est joignable (200 video/mp4)", async ({ request }) => {
    // Auth via le proxy Next : pose le cookie de session httpOnly dans le contexte.
    const login = await request.post("/api/auth/login", {
      data: { login: "admin@infinity-uae.com", password: "Admin12345!" },
    });
    expect(login.ok(), "login échoué").toBeTruthy();

    const res = await request.get("/api/admin/scenarios?listing_type=sale&limit=200");
    expect(res.ok(), "GET scenarios échoué").toBeTruthy();
    const data = (await res.json()).data as Scenario[];

    const scenario = data.find((s) => s.title === E2E_TITLE);
    expect(
      scenario,
      `scénario seedé « ${E2E_TITLE} » absent — lancer scripts/seed_ready_scenario_video.py`,
    ).toBeTruthy();
    expect(scenario!.status).toBe("ready");
    expect(scenario!.video_url, "video_url manquant").toBeTruthy();

    // Présignature contre l'endpoint public (joignable navigateur), pas l'hôte interne Docker.
    expect(scenario!.video_url!).toContain("9000");

    // Fetch navigateur-équivalent de l'URL présignée → la vidéo est réellement servie.
    const video = await request.get(scenario!.video_url!);
    expect(video.status(), "URL présignée non joignable").toBe(200);
    expect(video.headers()["content-type"]).toContain("video/");
  });
});
