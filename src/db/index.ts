import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

// `next build` loads this module without a database (e.g. in CI), so only
// require the connection string when the app actually runs.
const isBuild = process.env.NEXT_PHASE === "phase-production-build";

if (!connectionString && !isBuild) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and start Postgres (docker compose up -d)."
  );
}

// Reuse a single connection across hot reloads in development to avoid
// exhausting the database with new pools on every change.
const globalForDb = globalThis as unknown as {
  client: ReturnType<typeof postgres> | undefined;
};

// postgres() connects lazily, so an empty string during the build is harmless.
const client = globalForDb.client ?? postgres(connectionString ?? "");
if (process.env.NODE_ENV !== "production") {
  globalForDb.client = client;
}

export const db = drizzle(client, { schema });
export { schema };
