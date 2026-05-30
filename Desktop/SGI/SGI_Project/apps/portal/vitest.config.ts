import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Helpers fetch/dictée purs — environnement Node (pas de DOM nécessaire).
    environment: "node",
    globals: true,
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
  },
});
