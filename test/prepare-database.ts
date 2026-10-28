import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import {
  assertTestDatabase,
  databaseName,
  toTestDatabaseUrl,
} from "./database-url";

// The app's DATABASE_URL: from the environment (CI) or from .env (locally).
export function readAppDatabaseUrl(): string {
  const env: Record<string, string> = {};
  config({ path: ".env", processEnv: env, quiet: true });
  const url = process.env.DATABASE_URL ?? env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and start Postgres (docker compose up -d)."
    );
  }
  return url;
}

// Creates the test database if it is missing and applies the migrations from
// ./drizzle. Connects through the server's built-in "postgres" database, since
// the test one may not exist yet.
export async function prepareTestDatabase(testUrl: string): Promise<void> {
  const testName = databaseName(testUrl);
  assertTestDatabase(testName);

  const admin = postgres(toTestDatabaseUrl(testUrl, "postgres"), {
    max: 1,
    onnotice: () => {},
  });
  try {
    const existing =
      await admin`select 1 from pg_database where datname = ${testName}`;
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
}
