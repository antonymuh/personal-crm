import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { contactGroups, contacts, groups, user } from "@/db/schema";
import { addContact, addGroup, addUser, resetDatabase } from "../../test/db";

beforeEach(resetDatabase);

async function contactInGroup(contactName: string, groupName: string) {
  const owner = await addUser();
  const contact = await addContact(owner.id, contactName);
  const group = await addGroup(owner.id, groupName);
  await db
    .insert(contactGroups)
    .values({ contactId: contact.id, groupId: group.id });
  return { owner, contact, group };
}

describe("groups schema", () => {
  it("stores groups and memberships", async () => {
    const { contact, group } = await contactInGroup("Анна", "Семья");
    const rows = await db.select().from(contactGroups);
    expect(rows).toEqual([{ contactId: contact.id, groupId: group.id }]);
  });

  it("rejects a group name of the same user that differs only in case", async () => {
    const owner = await addUser();
    await addGroup(owner.id, "Теннис");
    await expect(addGroup(owner.id, "теннис")).rejects.toThrow();
    expect(await db.$count(groups)).toBe(1);
  });

  it("lets two users have a group with the same name", async () => {
    const anna = await addUser("anna@example.com");
    const boris = await addUser("boris@example.com");
    await addGroup(anna.id, "Друзья");
    await addGroup(boris.id, "друзья");
    expect(await db.$count(groups)).toBe(2);
  });

  it("keeps the group when its only contact is deleted", async () => {
    const { contact, group } = await contactInGroup("Аня", "Аналитики");
    await db.delete(contacts).where(eq(contacts.id, contact.id));

    expect(await db.$count(contactGroups)).toBe(0);
    const left = await db.select().from(groups);
    expect(left.map((g) => g.id)).toEqual([group.id]);
  });

  it("keeps the contacts when a group is deleted", async () => {
    const { contact, group } = await contactInGroup("Борис", "Теннис");
    await db.delete(groups).where(eq(groups.id, group.id));

    expect(await db.$count(contactGroups)).toBe(0);
    const left = await db.select().from(contacts);
    expect(left.map((c) => c.id)).toEqual([contact.id]);
  });
});

describe("owner schema", () => {
  it("has the sign-in tables", async () => {
    const rows = await db.execute<{ tablename: string }>(
      sql`select tablename from pg_tables where schemaname = 'public'`
    );
    expect(rows.map((r) => r.tablename)).toEqual(
      expect.arrayContaining([
        "user",
        "session",
        "account",
        "verification",
        "sign_in_emails",
      ])
    );
  });

  it("requires an owner for contacts and groups", async () => {
    await expect(
      db.execute(sql`insert into contacts (name) values ('Анна')`)
    ).rejects.toThrow();
    await expect(
      db.execute(sql`insert into groups (name) values ('Семья')`)
    ).rejects.toThrow();
  });

  it("rejects a second user with the same email", async () => {
    await addUser("anna@example.com");
    await expect(addUser("anna@example.com")).rejects.toThrow();
  });

  it("removes the user's contacts and groups together with the user", async () => {
    const { owner } = await contactInGroup("Вера", "Семья");
    await db.delete(user).where(eq(user.id, owner.id));

    expect(await db.$count(contacts)).toBe(0);
    expect(await db.$count(groups)).toBe(0);
    expect(await db.$count(contactGroups)).toBe(0);
  });
});
