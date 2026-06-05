import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  // Turbopack is stable in Next.js 15.3+ — no longer experimental
  // Build standalone server.js pour runtime Docker slim.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // ESLint déclenché séparément via `pnpm lint` (et en CI).
  // On ne veut pas qu'une apostrophe non-échappée bloque un déploiement.
  eslint: { ignoreDuringBuilds: true },
  // Cache : le shell HTML (document) + les routes proxy ne doivent JAMAIS être
  // servis périmés depuis le cache navigateur — ils référencent les chunks
  // hashés du dernier build. Sans ça, après un rebuild prod (sans hot-reload),
  // un navigateur gardait l'ancien HTML → ancien bundle → features « disparues »
  // (ex. l'assistant). On force donc `no-store`. Les assets `/_next/static`
  // (hash de contenu, URL unique par build) restent `immutable` (gérés par Next).
  async headers() {
    return [
      {
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default config;
