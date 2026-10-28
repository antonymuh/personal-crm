import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { contacts, notes } from "@/db/schema";
import { setContactGroups } from "@/db/groups";
import { getContactGroups, listContacts } from "@/db/contact-list";
import { addContact, addGroup, resetDatabase } from "../../test/db";

beforeEach(resetDatabase);

// "Анна" (Семья), "Борис" (Теннис), "Вера" (Семья, Теннис), "Глеб" (no groups).
async function seedPeople() {
  const family = await addGroup("Семья");
  const tennis = await addGroup("Теннис");
  const anna = await addContact("Анна");
  const boris = await addContact("Борис");
  const vera = await addContact("Вера");
  const gleb = await addContact("Глеб");
  await setContactGroups(anna.id, [family.id]);
  await setContactGroups(boris.id, [tennis.id]);
  await setContactGroups(vera.id, [tennis.id, family.id]);
  return { family, tennis, anna, boris, vera, gleb };
}

const names = (rows: { name: string }[]) => rows.map((r) => r.name);

describe("listContacts", () => {
  it("shows each contact's groups alphabetically", async () => {
    await seedPeople();
    const rows = await listContacts({ query: "", groupId: null });
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
    const rows = await listContacts({ query: "", groupId: null });
    expect(names(rows)).toEqual(["Анна", "Борис", "Вера", "Глеб"]);
  });

  it("keeps only the chosen group's contacts", async () => {
    const { tennis } = await seedPeople();
    const rows = await listContacts({ query: "", groupId: tennis.id });
    expect(names(rows)).toEqual(["Борис", "Вера"]);
  });

  it("combines the group filter with the name search", async () => {
    const { family } = await seedPeople();
    const rows = await listContacts({ query: "Ве", groupId: family.id });
    expect(names(rows)).toEqual(["Вера"]);
  });

  it("puts contacts it is time to get in touch with first inside a group", async () => {
    const { family } = await seedPeople();
    const yana = await addContact("Яна");
    await db.update(contacts).set({ contactFrequency: "week" });
    // Everyone was just contacted except Яна, who never was.
    await db.update(contacts).set({ lastContactedAt: new Date() });
    await db.update(contacts).set({ lastContactedAt: null }).where(eq(contacts.id, yana.id));
    await setContactGroups(yana.id, [family.id]);

    const rows = await listContacts({ query: "", groupId: family.id });

    expect(rows.map((r) => [r.name, r.isDue])).toEqual([
      ["Яна", true],
      ["Анна", false],
      ["Вера", false],
    ]);
  });

  it("returns nobody for an empty group", async () => {
    await seedPeople();
    const empty = await addGroup("Аналитики");
    expect(await listContacts({ query: "", groupId: empty.id })).toEqual([]);
  });

  it("still counts notes", async () => {
    const { anna } = await seedPeople();
    await db.insert(notes).values([
      { contactId: anna.id, body: "Первая" },
      { contactId: anna.id, body: "Вторая" },
    ]);
    const rows = await listContacts({ query: "Анна", groupId: null });
    expect(rows).toEqual([
      expect.objectContaining({ name: "Анна", noteCount: 2, groupNames: ["Семья"] }),
    ]);
  });
});

describe("getContactGroups", () => {
  it("returns the contact's groups alphabetically", async () => {
    const { vera, family, tennis } = await seedPeople();
    expect(await getContactGroups(vera.id)).toEqual([
      { id: family.id, name: "Семья" },
      { id: tennis.id, name: "Теннис" },
    ]);
  });

  it("returns nothing for a contact without groups", async () => {
    const { gleb } = await seedPeople();
    expect(await getContactGroups(gleb.id)).toEqual([]);
  });
});
