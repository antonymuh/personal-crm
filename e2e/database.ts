import postgres from "postgres";

import {
  E2E_DATABASE_NAME,
  assertTestDatabase,
  databaseName,
  toTestDatabaseUrl,
} from "../test/database-url";
import { readAppDatabaseUrl } from "../test/prepare-database";

// The database the app under test uses: same server as the app, separate name.
export function e2eDatabaseUrl(): string {
  return toTestDatabaseUrl(readAppDatabaseUrl(), E2E_DATABASE_NAME);
}

// Runs a callback with a short-lived connection to the e2e database.
export async function withE2eDatabase<T>(
  run: (sql: postgres.Sql) => Promise<T>
): Promise<T> {
  const url = e2eDatabaseUrl();
  assertTestDatabase(databaseName(url));
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    return await run(sql);
  } finally {
    await sql.end();
  }
}

// Empties every app table, so each test starts from a blank database.
export async function resetE2eDatabase(): Promise<void> {
  await withE2eDatabase(async (sql) => {
    const tables = await sql<{ tablename: string }[]>`
      select tablename from pg_tables where schemaname = 'public'`;
    if (tables.length === 0) return;
    await sql`truncate table ${sql(tables.map((t) => t.tablename))} restart identity cascade`;
  });
}
