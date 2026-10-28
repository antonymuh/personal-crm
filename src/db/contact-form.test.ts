import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { contacts, groups } from "@/db/schema";
import { setContactGroups } from "@/db/groups";
import {
  createContactFromForm,
  updateContactFromForm,
} from "@/db/contact-form";
import {
  addContact,
  addGroup,
  groupNamesOf,
  resetDatabase,
} from "../../test/db";

beforeEach(resetDatabase);

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) data.append(key, v);
  }
  return data;
}

async function allGroupNames() {
  const rows = await db.select({ name: groups.name }).from(groups);
  return rows.map((r) => r.name).sort();
}

async function contactRow(id: number) {
  const [row] = await db.select().from(contacts).where(eq(contacts.id, id));
  return row;
}

describe("createContactFromForm", () => {
  it("puts the new contact into the checked groups", async () => {
    const friends = await addGroup("Друзья");
    const tennis = await addGroup("Теннис");

    const result = await createContactFromForm(
      form({ name: "Вера", groupIds: [String(friends.id), String(tennis.id)] })
    );

    if (!result.ok) throw new Error(result.error);
    expect(await groupNamesOf(result.contactId)).toEqual(["Друзья", "Теннис"]);
  });

  it("saves the other contact fields as before", async () => {
    const result = await createContactFromForm(
      form({
        name: "  Анна  ",
        howWeMet: "Школа",
        phone: "",
        email: "anna@example.com",
        contactFrequency: "month",
      })
    );

    if (!result.ok) throw new Error(result.error);
    expect(await contactRow(result.contactId)).toMatchObject({
      name: "Анна",
      howWeMet: "Школа",
      phone: null,
      email: "anna@example.com",
      contactFrequency: "month",
    });
  });

  it("leaves the contact without groups when none are checked", async () => {
    await addGroup("Друзья");

    const result = await createContactFromForm(form({ name: "Анна" }));

    if (!result.ok) throw new Error(result.error);
    expect(await groupNamesOf(result.contactId)).toEqual([]);
  });

  it("creates a new group and puts the contact into it", async () => {
    const result = await createContactFromForm(
      form({ name: "Анна", newGroup: "  Семья  " })
    );

    if (!result.ok) throw new Error(result.error);
    expect(await allGroupNames()).toEqual(["Семья"]);
    expect(await groupNamesOf(result.contactId)).toEqual(["Семья"]);
  });

  it("combines a checked group with a new one", async () => {
    const friends = await addGroup("Друзья");

    const result = await createContactFromForm(
      form({
        name: "Анна",
        groupIds: [String(friends.id)],
        newGroup: "Аналитики",
      })
    );

    if (!result.ok) throw new Error(result.error);
    expect(await groupNamesOf(result.contactId)).toEqual([
      "Аналитики",
      "Друзья",
    ]);
  });

  it("does not duplicate a group that is both checked and typed as new", async () => {
    const tennis = await addGroup("Теннис");

    const result = await createContactFromForm(
      form({ name: "Борис", groupIds: [String(tennis.id)], newGroup: "теннис" })
    );

    if (!result.ok) throw new Error(result.error);
    expect(await allGroupNames()).toEqual(["Теннис"]);
    expect(await groupNamesOf(result.contactId)).toEqual(["Теннис"]);
  });

  it("creates neither the contact nor the group when the name is empty", async () => {
    const result = await createContactFromForm(
      form({ name: "   ", newGroup: "Аналитики" })
    );

    expect(result).toEqual({ ok: false, error: "Укажите имя контакта" });
    expect(await db.$count(contacts)).toBe(0);
    expect(await db.$count(groups)).toBe(0);
  });

  it("creates nothing when the frequency is unknown", async () => {
    const result = await createContactFromForm(
      form({ name: "Анна", contactFrequency: "daily", newGroup: "Аналитики" })
    );

    expect(result).toEqual({ ok: false, error: "Неизвестная частота общения" });
    expect(await db.$count(contacts)).toBe(0);
    expect(await db.$count(groups)).toBe(0);
  });
});

describe("updateContactFromForm", () => {
  it("puts the contact into the existing group when the new name differs only in case", async () => {
    await addGroup("Теннис");
    const contact = await addContact("Борис");

    const result = await updateContactFromForm(
      form({ id: String(contact.id), name: "Борис", newGroup: "теннис" })
    );

    expect(result).toEqual({ ok: true, contactId: contact.id });
    expect(await allGroupNames()).toEqual(["Теннис"]);
    expect(await groupNamesOf(contact.id)).toEqual(["Теннис"]);
  });

  it("removes the contact from an unchecked group and keeps the group", async () => {
    const friends = await addGroup("Друзья");
    const tennis = await addGroup("Теннис");
    const contact = await addContact("Вера");
    await setContactGroups(contact.id, [friends.id, tennis.id]);

    await updateContactFromForm(
      form({
        id: String(contact.id),
        name: "Вера",
        groupIds: [String(friends.id)],
      })
    );

    expect(await groupNamesOf(contact.id)).toEqual(["Друзья"]);
    expect(await allGroupNames()).toEqual(["Друзья", "Теннис"]);
  });

  it("updates the contact fields", async () => {
    const contact = await addContact("Вера");

    await updateContactFromForm(
      form({ id: String(contact.id), name: "Вера Орлова", phone: "+7 900" })
    );

    expect(await contactRow(contact.id)).toMatchObject({
      name: "Вера Орлова",
      phone: "+7 900",
    });
  });

  it("changes nothing when the name is empty", async () => {
    const contact = await addContact("Вера");

    const result = await updateContactFromForm(
      form({ id: String(contact.id), name: "", newGroup: "Аналитики" })
    );

    expect(result).toEqual({ ok: false, error: "Укажите имя контакта" });
    expect(await db.$count(groups)).toBe(0);
    expect((await contactRow(contact.id)).name).toBe("Вера");
  });

  it("reports a missing contact and creates no group", async () => {
    const result = await updateContactFromForm(
      form({ id: "999", name: "Вера", newGroup: "Аналитики" })
    );

    expect(result).toEqual({ ok: false, error: "Контакт не найден" });
    expect(await db.$count(groups)).toBe(0);
  });
});
