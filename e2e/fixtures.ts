import { test as base } from "@playwright/test";

import { resetE2eDatabase } from "./database";

// Every test starts with an empty database.
export const test = base.extend<{ cleanDatabase: void }>({
  cleanDatabase: [
    async ({}, use) => {
      await resetE2eDatabase();
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
