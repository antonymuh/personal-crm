// Applies pending Drizzle migrations from ./drizzle and exits.
// Runs as a one-off container from the app image before the new app version starts.
import postgres from "postgres";

import { applyMigrations } from "./apply-migrations.mjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });

try {
  await applyMigrations(client, {
    migrationsFolder: "./drizzle",
    ownerEmail: process.env.OWNER_EMAIL,
  });
  console.log("Migrations applied.");
} catch (err) {
  console.error("Migration failed:", err);
  process.exitCode = 1;
} finally {
  await client.end();
}
