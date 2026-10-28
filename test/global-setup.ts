import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { TestProject } from "vitest/node";

import { assertTestDatabase, databaseName, toTestDatabaseUrl } from "./database-url";

declare module "vitest" {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}

// Runs once before all test files: makes sure the test database exists and
// has the latest schema, then hands its address to the test workers.
export default async function setup(project: TestProject) {
  const env: Record<string, string> = {};
  config({ path: ".env", processEnv: env, quiet: true });
  const appUrl = process.env.DATABASE_URL ?? env.DATABASE_URL;
  if (!appUrl) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and start Postgres (docker compose up -d)."
    );
  }

  const testUrl = toTestDatabaseUrl(appUrl);
  const testName = databaseName(testUrl);
  assertTestDatabase(testName);

  const admin = postgres(appUrl, { max: 1, onnotice: () => {} });
  try {
    const existing = await admin`select 1 from pg_database where datname = ${testName}`;
    if (existing.length === 0) {
      await admin.unsafe(`create database "${testName}"`);
    }
  } catch (err) {
    throw new Error(
      `Cannot reach Postgres to prepare the test database. Is it running (docker compose up -d)?\n${err}`
    );
  } finally {
    await admin.end();
  }

  const client = postgres(testUrl, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  } finally {
    await client.end();
  }

  project.provide("testDatabaseUrl", testUrl);
}
