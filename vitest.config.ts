import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

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
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    // Database tests share one test database, so files run one at a time.
    fileParallelism: false,
  },
});
