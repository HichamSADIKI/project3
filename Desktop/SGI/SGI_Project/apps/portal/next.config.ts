import type { NextConfig } from "next";

const config: NextConfig = {
  // Turbopack stable en Next 15.3+
  transpilePackages: ["@sgi/shared-types", "@sgi/i18n"],
};

export default config;
