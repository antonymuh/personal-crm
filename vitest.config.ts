import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const fromRoot = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: fromRoot("./src/") },
      // Tests run outside Next.js, where "server-only" would throw on import.
      {
        find: /^server-only$/,
        replacement: fromRoot("./test/empty-module.ts"),
      },
    ],
  },
  test: {
    environment: "node",
    // Browser tests live in e2e/ and run with Playwright (pnpm test:e2e).
    exclude: [...configDefaults.exclude, "e2e/**"],
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    // Database tests share one test database, so files run one at a time.
    fileParallelism: false,
  },
});
