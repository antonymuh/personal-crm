import { sql } from "drizzle-orm";

import { db } from "@/db";

export const dynamic = "force-dynamic";

// Smoke check used by the deploy script: the app is up and can reach the database.
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok" });
  } catch (err) {
    console.error("Health check failed", err);
    return Response.json({ status: "error" }, { status: 503 });
  }
}
