import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { contacts, groups, type User } from "@/db/schema";
import { setContactGroups } from "@/db/groups";
import {
  createContactFromForm,
  updateContactFromForm,
} from "@/db/contact-form";
import {
  addContact,
  addGroup,
  addUser,
  groupNamesOf,
  resetDatabase,
} from "../../test/db";

let me: User;
let other: User;

beforeEach(async () => {
  await resetDatabase();
  me = await addUser("anna@example.com");
  other = await addUser("boris@example.com");
});

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
    const friends = await addGroup(me.id, "Друзья");
    const tennis = await addGroup(me.id, "Теннис");

    const result = await createContactFromForm(
      me.id,
      form({ name: "Вера", groupIds: [String(friends.id), String(tennis.id)] })
    );

    if (!result.ok) throw new Error(result.error);
    expect(await groupNamesOf(result.contactId)).toEqual(["Друзья", "Теннис"]);
  });

  it("saves the other contact fields as before, owned by the user", async () => {
    const result = await createContactFromForm(
      me.id,
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
      userId: me.id,
      name: "Анна",
      howWeMet: "Школа",
      phone: null,
      email: "anna@example.com",
      contactFrequency: "month",
    });
  });

  it("leaves the contact without groups when none are checked", async () => {
    await addGroup(me.id, "Друзья");

    const result = await createContactFromForm(me.id, form({ name: "Анна" }));

    if (!result.ok) throw new Error(result.error);
    expect(await groupNamesOf(result.contactId)).toEqual([]);
  });

  it("creates a new group owned by the user and puts the contact into it", async () => {
    const result = await createContactFromForm(
      me.id,
      form({ name: "Анна", newGroup: "  Семья  " })
    );

    if (!result.ok) throw new Error(result.error);
    expect(await allGroupNames()).toEqual(["Семья"]);
    expect(await groupNamesOf(result.contactId)).toEqual(["Семья"]);
    const [group] = await db.select().from(groups);
    expect(group.userId).toBe(me.id);
  });

  it("creates its own group even when another user has one with that name", async () => {
    await addGroup(other.id, "Теннис");

    const result = await createContactFromForm(
      me.id,
      form({ name: "Анна", newGroup: "теннис" })
    );

    if (!result.ok) throw new Error(result.error);
    expect(await allGroupNames()).toEqual(["Теннис", "теннис"]);
    expect(await groupNamesOf(result.contactId)).toEqual(["теннис"]);
  });

  it("does not put the contact into another user's group", async () => {
    const theirs = await addGroup(other.id, "Теннис");

    const result = await createContactFromForm(
      me.id,
      form({ name: "Анна", groupIds: [String(theirs.id)] })
    );

    if (!result.ok) throw new Error(result.error);
    expect(await groupNamesOf(result.contactId)).toEqual([]);
  });

  it("combines a checked group with a new one", async () => {
    const friends = await addGroup(me.id, "Друзья");

    const result = await createContactFromForm(
      me.id,
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
    const tennis = await addGroup(me.id, "Теннис");

    const result = await createContactFromForm(
      me.id,
      form({ name: "Борис", groupIds: [String(tennis.id)], newGroup: "теннис" })
    );

    if (!result.ok) throw new Error(result.error);
    expect(await allGroupNames()).toEqual(["Теннис"]);
    expect(await groupNamesOf(result.contactId)).toEqual(["Теннис"]);
  });

  it("creates neither the contact nor the group when the name is empty", async () => {
    const result = await createContactFromForm(
      me.id,
      form({ name: "   ", newGroup: "Аналитики" })
    );

    expect(result).toEqual({ ok: false, error: "Укажите имя контакта" });
    expect(await db.$count(contacts)).toBe(0);
    expect(await db.$count(groups)).toBe(0);
  });

  it("creates nothing when the frequency is unknown", async () => {
    const result = await createContactFromForm(
      me.id,
      form({ name: "Анна", contactFrequency: "daily", newGroup: "Аналитики" })
    );

    expect(result).toEqual({ ok: false, error: "Неизвестная частота общения" });
    expect(await db.$count(contacts)).toBe(0);
    expect(await db.$count(groups)).toBe(0);
  });

  describe("birth date", () => {
    const TODAY = "2026-11-13";

    it("saves the birth date", async () => {
      const result = await createContactFromForm(
        me.id,
        form({ name: "Анна", birthDate: "1990-11-15" }),
        db,
        TODAY
      );

      if (!result.ok) throw new Error(result.error);
      expect((await contactRow(result.contactId)).birthDate).toBe("1990-11-15");
    });

    it("saves no birth date when the field is not filled", async () => {
      const result = await createContactFromForm(
        me.id,
        form({ name: "Анна", birthDate: "" }),
        db,
        TODAY
      );
      const withoutField = await createContactFromForm(
        me.id,
        form({ name: "Борис" }),
        db,
        TODAY
      );

      if (!result.ok || !withoutField.ok) throw new Error("not saved");
      expect((await contactRow(result.contactId)).birthDate).toBeNull();
      expect((await contactRow(withoutField.contactId)).birthDate).toBeNull();
    });

    it.each([
      ["2026-11-14", "Дата рождения не может быть в будущем"],
      ["2026-02-31", "Некорректная дата рождения"],
      ["1899-12-31", "Некорректная дата рождения"],
      ["abc", "Некорректная дата рождения"],
    ])("creates nothing for %s", async (birthDate, error) => {
      const result = await createContactFromForm(
        me.id,
        form({ name: "Анна", birthDate, newGroup: "Аналитики" }),
        db,
        TODAY
      );

      expect(result).toEqual({ ok: false, error });
      expect(await db.$count(contacts)).toBe(0);
      expect(await db.$count(groups)).toBe(0);
    });
  });
});

describe("updateContactFromForm", () => {
  it("puts the contact into the existing group when the new name differs only in case", async () => {
    await addGroup(me.id, "Теннис");
    const contact = await addContact(me.id, "Борис");

    const result = await updateContactFromForm(
      me.id,
      form({ id: String(contact.id), name: "Борис", newGroup: "теннис" })
    );

    expect(result).toEqual({ ok: true, contactId: contact.id });
    expect(await allGroupNames()).toEqual(["Теннис"]);
    expect(await groupNamesOf(contact.id)).toEqual(["Теннис"]);
  });

  it("removes the contact from an unchecked group and keeps the group", async () => {
    const friends = await addGroup(me.id, "Друзья");
    const tennis = await addGroup(me.id, "Теннис");
    const contact = await addContact(me.id, "Вера");
    await setContactGroups(me.id, contact.id, [friends.id, tennis.id]);

    await updateContactFromForm(
      me.id,
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
    const contact = await addContact(me.id, "Вера");

    await updateContactFromForm(
      me.id,
      form({ id: String(contact.id), name: "Вера Орлова", phone: "+7 900" })
    );

    expect(await contactRow(contact.id)).toMatchObject({
      name: "Вера Орлова",
      phone: "+7 900",
    });
  });

  it("changes nothing when the name is empty", async () => {
    const contact = await addContact(me.id, "Вера");

    const result = await updateContactFromForm(
      me.id,
      form({ id: String(contact.id), name: "", newGroup: "Аналитики" })
    );

    expect(result).toEqual({ ok: false, error: "Укажите имя контакта" });
    expect(await db.$count(groups)).toBe(0);
    expect((await contactRow(contact.id)).name).toBe("Вера");
  });

  it("reports a missing contact and creates no group", async () => {
    const result = await updateContactFromForm(
      me.id,
      form({ id: "999", name: "Вера", newGroup: "Аналитики" })
    );

    expect(result).toEqual({ ok: false, error: "Контакт не найден" });
    expect(await db.$count(groups)).toBe(0);
  });

  it("treats another user's contact as missing and changes nothing", async () => {
    const theirs = await addContact(other.id, "Борис");
    const family = await addGroup(other.id, "Семья");
    await setContactGroups(other.id, theirs.id, [family.id]);

    const result = await updateContactFromForm(
      me.id,
      form({ id: String(theirs.id), name: "Взломан", newGroup: "Аналитики" })
    );

    expect(result).toEqual({ ok: false, error: "Контакт не найден" });
    expect((await contactRow(theirs.id)).name).toBe("Борис");
    expect(await groupNamesOf(theirs.id)).toEqual(["Семья"]);
    expect(await allGroupNames()).toEqual(["Семья"]);
  });

  describe("birth date", () => {
    const TODAY = "2026-11-13";

    async function addContactBorn(birthDate: string | null, name = "Вера") {
      const contact = await addContact(me.id, name);
      await db
        .update(contacts)
        .set({ birthDate })
        .where(eq(contacts.id, contact.id));
      return contact;
    }

    it("changes the birth date", async () => {
      const contact = await addContactBorn("1990-11-15");

      const result = await updateContactFromForm(
        me.id,
        form({ id: String(contact.id), name: "Вера", birthDate: "1985-03-03" }),
        db,
        TODAY
      );

      expect(result).toEqual({ ok: true, contactId: contact.id });
      expect((await contactRow(contact.id)).birthDate).toBe("1985-03-03");
    });

    it("erases the birth date when the field is empty", async () => {
      const contact = await addContactBorn("1990-11-15");

      await updateContactFromForm(
        me.id,
        form({ id: String(contact.id), name: "Вера", birthDate: "" }),
        db,
        TODAY
      );

      expect((await contactRow(contact.id)).birthDate).toBeNull();
    });

    it("changes nothing when the new name comes with a date in the future", async () => {
      const contact = await addContactBorn("1990-11-15");

      const result = await updateContactFromForm(
        me.id,
        form({
          id: String(contact.id),
          name: "Новое имя",
          birthDate: "2026-11-14",
          newGroup: "Аналитики",
        }),
        db,
        TODAY
      );

      expect(result).toEqual({
        ok: false,
        error: "Дата рождения не может быть в будущем",
      });
      expect(await contactRow(contact.id)).toMatchObject({
        name: "Вера",
        birthDate: "1990-11-15",
      });
      expect(await db.$count(groups)).toBe(0);
    });

    it.each([["2026-02-31"], ["1899-12-31"]])(
      "keeps the old date for %s",
      async (birthDate) => {
        const contact = await addContactBorn("1990-11-15");

        const result = await updateContactFromForm(
          me.id,
          form({ id: String(contact.id), name: "Вера", birthDate }),
          db,
          TODAY
        );

        expect(result).toEqual({
          ok: false,
          error: "Некорректная дата рождения",
        });
        expect((await contactRow(contact.id)).birthDate).toBe("1990-11-15");
      }
    );
  });
});
