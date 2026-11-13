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

// The migration that adds the birth date, checked on a database of its own
// that starts at the schema from before birthdays existed.
const DATABASE = "personal_crm_birthdays_migration_test";
// Migrations already applied in production before birthdays were added.
const BEFORE_BIRTHDAYS = 4;

const testUrl = toTestDatabaseUrl(inject("testDatabaseUrl"), DATABASE);
assertTestDatabase(DATABASE);

const oldMigrations = mkdtempSync(join(tmpdir(), "crm-migrations-"));
cpSync("drizzle", oldMigrations, { recursive: true });
const journalPath = join(oldMigrations, "meta", "_journal.json");
const journal = JSON.parse(readFileSync(journalPath, "utf8"));
journal.entries = journal.entries.slice(0, BEFORE_BIRTHDAYS);
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

// Data as it looks in production right before the deploy of birthdays.
async function addOldData() {
  await sql`insert into "user" (id, name, email, email_verified)
    values ('user-1', '', 'me@example.com', true)`;
  const [anna, boris] = await sql<{ id: number }[]>`
    insert into contacts (user_id, name, how_we_met, phone, email, contact_frequency, last_contacted_at)
    values
      ('user-1', 'Анна', 'Универ', '+7 900 000-00-01', 'anna@example.com', 'month', '2026-10-01T10:00:00Z'),
      ('user-1', 'Борис', null, null, null, null, null)
    returning id`;
  await sql`insert into notes (contact_id, body) values
    (${anna.id}, 'Созвонились'), (${anna.id}, 'Встретились'), (${boris.id}, 'Написал')`;
  const [family, tennis] = await sql<{ id: number }[]>`
    insert into groups (user_id, name) values ('user-1', 'Семья'), ('user-1', 'Теннис') returning id`;
  await sql`insert into contact_groups (contact_id, group_id) values
    (${anna.id}, ${family.id}), (${boris.id}, ${tennis.id})`;
}

// Everything about the contacts, notes and memberships except the new column.
async function snapshot() {
  const contacts = await sql`
    select id, user_id, name, how_we_met, phone, email, contact_frequency,
           last_contacted_at, created_at, updated_at
    from contacts order by id`;
  const notes = await sql`
    select id, contact_id, body, created_at from notes order by id`;
  const memberships = await sql`
    select contact_id, group_id from contact_groups order by contact_id, group_id`;
  return { contacts, notes, memberships };
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

describe("birthdays migration", () => {
  it("leaves the birth date empty for existing contacts and changes nothing else", async () => {
    await addOldData();
    const before = await snapshot();

    await applyMigrations(sql, { migrationsFolder: "drizzle" });

    expect(await snapshot()).toEqual(before);
    const rows = await sql<{ name: string; birth_date: string | null }[]>`
      select name, birth_date from contacts order by id`;
    expect(rows).toEqual([
      { name: "Анна", birth_date: null },
      { name: "Борис", birth_date: null },
    ]);
  });
});
