import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { inject } from "vitest";

import { applyMigrations } from "../scripts/apply-migrations.mjs";
import { assertTestDatabase, toTestDatabaseUrl } from "./database-url";

// The migration that gives existing data an owner, checked on a database of
// its own that starts at the schema from before sign-in existed.
const DATABASE = "personal_crm_migration_test";
// Migrations already applied in production before sign-in was added.
const BEFORE_SIGN_IN = 3;

const testUrl = toTestDatabaseUrl(inject("testDatabaseUrl"), DATABASE);
assertTestDatabase(DATABASE);

const oldMigrations = mkdtempSync(join(tmpdir(), "crm-migrations-"));
cpSync("drizzle", oldMigrations, { recursive: true });
const journalPath = join(oldMigrations, "meta", "_journal.json");
const journal = JSON.parse(readFileSync(journalPath, "utf8"));
journal.entries = journal.entries.slice(0, BEFORE_SIGN_IN);
writeFileSync(journalPath, JSON.stringify(journal));

let sql: postgres.Sql;

async function recreateDatabase() {
  const admin = postgres(toTestDatabaseUrl(testUrl, "postgres"), {
    max: 1,
    onnotice: () => {},
  });
  try {
    await admin.unsafe(`drop database if exists "${DATABASE}" with (force)`);
    await admin.unsafe(`create database "${DATABASE}"`);
  } finally {
    await admin.end();
  }
}

// Data as it looks in production right before the deploy of sign-in.
async function addOldData() {
  const [anna, boris] = await sql<{ id: number }[]>`
    insert into contacts (name) values ('Анна'), ('Борис') returning id`;
  await sql`insert into notes (contact_id, body) values
    (${anna.id}, 'Созвонились'), (${anna.id}, 'Встретились'), (${boris.id}, 'Написал')`;
  const [family, tennis] = await sql<{ id: number }[]>`
    insert into groups (name) values ('Семья'), ('Теннис') returning id`;
  await sql`insert into contact_groups (contact_id, group_id) values
    (${anna.id}, ${family.id}), (${boris.id}, ${tennis.id})`;
}

async function counts() {
  const [row] = await sql<
    { contacts: number; notes: number; groups: number; memberships: number }[]
  >`select
      (select count(*)::int from contacts) as contacts,
      (select count(*)::int from notes) as notes,
      (select count(*)::int from groups) as groups,
      (select count(*)::int from contact_groups) as memberships`;
  return row;
}

beforeEach(async () => {
  await recreateDatabase();
  sql = postgres(testUrl, { max: 1, onnotice: () => {} });
  await applyMigrations(sql, { migrationsFolder: oldMigrations });
});

afterEach(async () => {
  await sql.end();
});

afterAll(() => {
  rmSync(oldMigrations, { recursive: true, force: true });
});

describe("owner migration", () => {
  it("gives every existing contact and group to the owner and loses nothing", async () => {
    await addOldData();
    const before = await counts();

    await applyMigrations(sql, {
      migrationsFolder: "drizzle",
      ownerEmail: "  Me@Example.COM ",
    });

    expect(await counts()).toEqual(before);
    const users = await sql<{ id: string; email: string }[]>`
      select id, email from "user"`;
    expect(users.map((u) => u.email)).toEqual(["me@example.com"]);
    const owners = await sql<{ user_id: string }[]>`
      select user_id from contacts union select user_id from groups`;
    expect(owners).toEqual([{ user_id: users[0].id }]);
  });

  it("stops without changing anything when the owner email is not set", async () => {
    await addOldData();
    const before = await counts();

    await expect(
      applyMigrations(sql, { migrationsFolder: "drizzle" })
    ).rejects.toThrow(/OWNER_EMAIL/);

    expect(await counts()).toEqual(before);
    const [{ exists }] = await sql<{ exists: boolean }[]>`
      select exists (select 1 from information_schema.columns
        where table_name = 'contacts' and column_name = 'user_id') as exists`;
    expect(exists).toBe(false);
  });

  it("treats a blank owner email as not set", async () => {
    await addOldData();
    await expect(
      applyMigrations(sql, { migrationsFolder: "drizzle", ownerEmail: "  " })
    ).rejects.toThrow(/OWNER_EMAIL/);
  });

  it("needs no owner email for an empty database", async () => {
    await applyMigrations(sql, { migrationsFolder: "drizzle" });
    const [{ users }] = await sql<{ users: number }[]>`
      select count(*)::int as users from "user"`;
    expect(users).toBe(0);
  });
});
