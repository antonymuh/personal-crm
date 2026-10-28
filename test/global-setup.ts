import type { TestProject } from "vitest/node";

import { toTestDatabaseUrl } from "./database-url";
import { prepareTestDatabase, readAppDatabaseUrl } from "./prepare-database";

declare module "vitest" {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}

// Runs once before all test files: makes sure the test database exists and
// has the latest schema, then hands its address to the test workers.
export default async function setup(project: TestProject) {
  const appUrl = readAppDatabaseUrl();
  const testUrl = toTestDatabaseUrl(appUrl);
  await prepareTestDatabase(testUrl);
  project.provide("testDatabaseUrl", testUrl);
}
