// SPDX-License-Identifier: Apache-2.0
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
  test: {
    // Node by default so the Midnight WASM runtime loads its node build.
    // Component tests opt into jsdom with a @vitest-environment docblock.
    environment: "node",
    // The WASM runtime does not survive being loaded in a forked worker.
    pool: "threads",
    include: ["__tests__/**/*.test.{ts,tsx}"],
    setupFiles: ["./__tests__/setup.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
