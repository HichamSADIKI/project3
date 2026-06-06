import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  // Turbopack stable en Next 15.3+
  transpilePackages: ["@sgi/shared-types", "@sgi/i18n"],
  // Build standalone server.js pour runtime Docker slim.
  // outputFileTracingRoot pointe vers la racine du monorepo afin
  // d'inclure packages/* dans le tracing pnpm-workspace.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default config;
