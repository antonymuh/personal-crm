// Applies pending Drizzle migrations. Shared by the deploy (scripts/migrate.mjs)
// and the test databases, so tests run the migrations exactly like production.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

/**
 * @param {import("postgres").Sql} client A connection with `max: 1`: the owner
 *   email is a session setting, so it must be set on the connection that migrates.
 * @param {{ migrationsFolder: string, ownerEmail?: string }} options
 *   `ownerEmail` (OWNER_EMAIL) owns the contacts and groups that existed before
 *   sign-in was added; the migration that adds owners fails without it if
 *   there is such data.
 */
export async function applyMigrations(
  client,
  { migrationsFolder, ownerEmail }
) {
  await client`select set_config('app.owner_email', ${ownerEmail ?? ""}, false)`;
  await migrate(drizzle(client), { migrationsFolder });
}
