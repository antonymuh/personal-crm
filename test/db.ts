import { randomUUID } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { contactGroups, contacts, groups, user } from "@/db/schema";

import { assertTestDatabase } from "./database-url";

// Empties every app table, so each test starts from a blank database.
export async function resetDatabase(): Promise<void> {
  const [{ name }] = await db.execute<{ name: string }>(
    sql`select current_database() as name`
  );
  assertTestDatabase(name);

  const tables = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`
  );
  if (tables.length === 0) return;
  const list = sql.join(
    tables.map((t) => sql.identifier(t.tablename)),
    sql`, `
  );
  await db.execute(sql`truncate table ${list} restart identity cascade`);
}

// A signed-up user, as Better Auth creates one on the first sign-in.
export async function addUser(email: string = "owner@example.com") {
  const [row] = await db
    .insert(user)
    .values({ id: randomUUID(), name: "", email, emailVerified: true })
    .returning();
  return row;
}

export async function addContact(userId: string, name: string) {
  const [row] = await db.insert(contacts).values({ userId, name }).returning();
  return row;
}

export async function addGroup(userId: string, name: string) {
  const [row] = await db.insert(groups).values({ userId, name }).returning();
  return row;
}

// Names of the contact's groups, alphabetically.
export async function groupNamesOf(contactId: number): Promise<string[]> {
  const rows = await db
    .select({ name: groups.name })
    .from(contactGroups)
    .innerJoin(groups, eq(groups.id, contactGroups.groupId))
    .where(eq(contactGroups.contactId, contactId))
    .orderBy(asc(groups.name));
  return rows.map((r) => r.name);
}
