import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { contacts } from "@/db/schema";

import { resetDatabase } from "./db";

describe("test database", () => {
  beforeEach(resetDatabase);

  it("is a separate _test database, not the real one", async () => {
    const [{ name }] = await db.execute<{ name: string }>(
      sql`select current_database() as name`
    );
    expect(name).toMatch(/_test$/);
  });

  it("is empty after a reset", async () => {
    await db.insert(contacts).values({ name: "Temporary" });
    await resetDatabase();
    expect(await db.$count(contacts)).toBe(0);
  });
});
