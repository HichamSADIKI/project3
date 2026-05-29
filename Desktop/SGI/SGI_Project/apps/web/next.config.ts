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
};

export default config;
