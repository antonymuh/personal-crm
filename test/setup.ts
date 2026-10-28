import { afterAll, inject } from "vitest";

import { assertTestDatabase, databaseName } from "./database-url";

// Runs in every test file before its imports, so "@/db" connects to the
// test database instead of the real one.
const testUrl = inject("testDatabaseUrl");
assertTestDatabase(databaseName(testUrl));
process.env.DATABASE_URL = testUrl;

// "@/db" keeps its client on globalThis outside production; close it so the
// worker does not hang on open connections.
afterAll(async () => {
  const { client } = globalThis as { client?: { end: () => Promise<void> } };
  await client?.end();
});
