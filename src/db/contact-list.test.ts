import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { contacts, notes, type User } from "@/db/schema";
import { setContactGroups } from "@/db/groups";
import { getContactGroups, listContacts } from "@/db/contact-list";
import { addContact, addGroup, addUser, resetDatabase } from "../../test/db";

let me: User;
let other: User;

beforeEach(async () => {
  await resetDatabase();
  me = await addUser("anna@example.com");
  other = await addUser("boris@example.com");
});

// "Анна" (Семья), "Борис" (Теннис), "Вера" (Семья, Теннис), "Глеб" (no groups).
async function seedPeople() {
  const family = await addGroup(me.id, "Семья");
  const tennis = await addGroup(me.id, "Теннис");
  const anna = await addContact(me.id, "Анна");
  const boris = await addContact(me.id, "Борис");
  const vera = await addContact(me.id, "Вера");
  const gleb = await addContact(me.id, "Глеб");
  await setContactGroups(me.id, anna.id, [family.id]);
  await setContactGroups(me.id, boris.id, [tennis.id]);
  await setContactGroups(me.id, vera.id, [tennis.id, family.id]);
  return { family, tennis, anna, boris, vera, gleb };
}

const names = (rows: { name: string }[]) => rows.map((r) => r.name);
const everyone = { query: "", groupId: null };

describe("listContacts", () => {
  it("shows each contact's groups alphabetically", async () => {
    await seedPeople();
    const rows = await listContacts(me.id, everyone);
    const byName = Object.fromEntries(rows.map((r) => [r.name, r.groupNames]));
    expect(byName).toEqual({
      Анна: ["Семья"],
      Борис: ["Теннис"],
      Вера: ["Семья", "Теннис"],
      Глеб: [],
    });
  });

  it("lists everyone without a filter", async () => {
    await seedPeople();
    const rows = await listContacts(me.id, everyone);
    expect(names(rows)).toEqual(["Анна", "Борис", "Вера", "Глеб"]);
  });

  it("keeps only the chosen group's contacts", async () => {
    const { tennis } = await seedPeople();
    const rows = await listContacts(me.id, { query: "", groupId: tennis.id });
    expect(names(rows)).toEqual(["Борис", "Вера"]);
  });

  it("combines the group filter with the name search", async () => {
    const { family } = await seedPeople();
    const rows = await listContacts(me.id, { query: "Ве", groupId: family.id });
    expect(names(rows)).toEqual(["Вера"]);
  });

  it("puts contacts it is time to get in touch with first inside a group", async () => {
    const { family } = await seedPeople();
    const yana = await addContact(me.id, "Яна");
    await db.update(contacts).set({ contactFrequency: "week" });
    // Everyone was just contacted except Яна, who never was.
    await db.update(contacts).set({ lastContactedAt: new Date() });
    await db
      .update(contacts)
      .set({ lastContactedAt: null })
      .where(eq(contacts.id, yana.id));
    await setContactGroups(me.id, yana.id, [family.id]);

    const rows = await listContacts(me.id, { query: "", groupId: family.id });

    expect(rows.map((r) => [r.name, r.isDue])).toEqual([
      ["Яна", true],
      ["Анна", false],
      ["Вера", false],
    ]);
  });

  it("returns nobody for an empty group", async () => {
    await seedPeople();
    const empty = await addGroup(me.id, "Аналитики");
    expect(await listContacts(me.id, { query: "", groupId: empty.id })).toEqual(
      []
    );
  });

  it("still counts notes", async () => {
    const { anna } = await seedPeople();
    await db.insert(notes).values([
      { contactId: anna.id, body: "Первая" },
      { contactId: anna.id, body: "Вторая" },
    ]);
    const rows = await listContacts(me.id, { query: "Анна", groupId: null });
    expect(rows).toEqual([
      expect.objectContaining({
        name: "Анна",
        noteCount: 2,
        groupNames: ["Семья"],
      }),
    ]);
  });
});

describe("listContacts for two users", () => {
  it("shows another user neither the list nor the search results of the first", async () => {
    await seedPeople();
    await addContact(other.id, "Дина");

    expect(names(await listContacts(other.id, everyone))).toEqual(["Дина"]);
    expect(
      await listContacts(other.id, { query: "Анна", groupId: null })
    ).toEqual([]);
  });

  it("does not show another user's due contact", async () => {
    const theirs = await addContact(other.id, "Егор");
    await db
      .update(contacts)
      .set({ contactFrequency: "week" })
      .where(eq(contacts.id, theirs.id));

    expect(await listContacts(me.id, everyone)).toEqual([]);
  });

  it("gives another user's group nobody", async () => {
    const { tennis } = await seedPeople();
    expect(
      await listContacts(other.id, { query: "", groupId: tennis.id })
    ).toEqual([]);
  });

  it("starts a new user with an empty list", async () => {
    await seedPeople();
    const newcomer = await addUser("new@example.com");
    expect(await listContacts(newcomer.id, everyone)).toEqual([]);
  });
});

describe("getContactGroups", () => {
  it("returns the contact's groups alphabetically", async () => {
    const { vera, family, tennis } = await seedPeople();
    expect(await getContactGroups(me.id, vera.id)).toEqual([
      { id: family.id, name: "Семья" },
      { id: tennis.id, name: "Теннис" },
    ]);
  });

  it("returns nothing for a contact without groups", async () => {
    const { gleb } = await seedPeople();
    expect(await getContactGroups(me.id, gleb.id)).toEqual([]);
  });

  it("returns nothing for another user's contact", async () => {
    const { vera } = await seedPeople();
    expect(await getContactGroups(other.id, vera.id)).toEqual([]);
  });
});
