import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { contacts, groups } from "@/db/schema";
import {
  deleteGroup,
  findOrCreateGroup,
  listGroups,
  renameGroup,
  setContactGroups,
} from "@/db/groups";
import {
  addContact,
  addGroup,
  groupNamesOf,
  resetDatabase,
} from "../../test/db";

beforeEach(resetDatabase);

async function groupName(id: number) {
  const [row] = await db.select().from(groups).where(eq(groups.id, id));
  return row?.name;
}

describe("listGroups", () => {
  it("is empty at first", async () => {
    expect(await listGroups()).toEqual([]);
  });

  it("lists groups alphabetically", async () => {
    await addGroup("Теннис");
    await addGroup("Друзья");
    await addGroup("аналитики");
    const names = (await listGroups()).map((g) => g.name);
    expect(names).toEqual(["аналитики", "Друзья", "Теннис"]);
  });
});

describe("findOrCreateGroup", () => {
  it("creates a new group", async () => {
    const group = await findOrCreateGroup("Семья");
    expect(group.name).toBe("Семья");
    expect((await listGroups()).map((g) => g.id)).toEqual([group.id]);
  });

  it("finds an existing group regardless of case", async () => {
    const tennis = await addGroup("Теннис");
    const found = await findOrCreateGroup("теннис");
    expect(found).toMatchObject({ id: tennis.id, name: "Теннис" });
    expect(await db.$count(groups)).toBe(1);
  });
});

describe("setContactGroups", () => {
  it("puts a contact into several groups", async () => {
    const contact = await addContact("Вера");
    const friends = await addGroup("Друзья");
    const tennis = await addGroup("Теннис");

    await setContactGroups(contact.id, [friends.id, tennis.id]);

    expect(await groupNamesOf(contact.id)).toEqual(["Друзья", "Теннис"]);
  });

  it("removes a contact from an unchecked group but keeps the group", async () => {
    const contact = await addContact("Вера");
    const friends = await addGroup("Друзья");
    const tennis = await addGroup("Теннис");
    await setContactGroups(contact.id, [friends.id, tennis.id]);

    await setContactGroups(contact.id, [friends.id]);

    expect(await groupNamesOf(contact.id)).toEqual(["Друзья"]);
    expect(await groupName(tennis.id)).toBe("Теннис");
  });

  it("leaves a contact without groups", async () => {
    const contact = await addContact("Анна");
    const friends = await addGroup("Друзья");
    await setContactGroups(contact.id, [friends.id]);

    await setContactGroups(contact.id, []);

    expect(await groupNamesOf(contact.id)).toEqual([]);
  });

  it("silently drops a group that no longer exists", async () => {
    const contact = await addContact("Анна");
    const friends = await addGroup("Друзья");
    const gone = await addGroup("Старая");
    await db.delete(groups).where(eq(groups.id, gone.id));

    await setContactGroups(contact.id, [friends.id, gone.id]);

    expect(await groupNamesOf(contact.id)).toEqual(["Друзья"]);
  });

  it("does not touch other contacts' groups", async () => {
    const anna = await addContact("Анна");
    const boris = await addContact("Борис");
    const family = await addGroup("Семья");
    await setContactGroups(anna.id, [family.id]);

    await setContactGroups(boris.id, []);

    expect(await groupNamesOf(anna.id)).toEqual(["Семья"]);
  });
});

describe("renameGroup", () => {
  it("renames a group and keeps its contacts", async () => {
    const group = await addGroup("Тенис");
    const boris = await addContact("Борис");
    const vera = await addContact("Вера");
    await setContactGroups(boris.id, [group.id]);
    await setContactGroups(vera.id, [group.id]);

    expect(await renameGroup(group.id, "Теннис")).toEqual({ ok: true });

    expect(await groupName(group.id)).toBe("Теннис");
    expect(await groupNamesOf(boris.id)).toEqual(["Теннис"]);
    expect(await groupNamesOf(vera.id)).toEqual(["Теннис"]);
  });

  it("refuses a name that another group already has", async () => {
    await addGroup("Друзья");
    const family = await addGroup("Семья");

    expect(await renameGroup(family.id, "друзья")).toEqual({
      ok: false,
      error: "Группа с таким названием уже есть",
    });
    expect(await groupName(family.id)).toBe("Семья");
  });

  it("allows changing only the case", async () => {
    const group = await addGroup("теннис");
    expect(await renameGroup(group.id, "Теннис")).toEqual({ ok: true });
    expect(await groupName(group.id)).toBe("Теннис");
  });

  it("refuses an empty name", async () => {
    const group = await addGroup("Теннис");
    expect(await renameGroup(group.id, "   ")).toEqual({
      ok: false,
      error: "Укажите название группы",
    });
    expect(await groupName(group.id)).toBe("Теннис");
  });

  it("trims spaces around the new name", async () => {
    const group = await addGroup("Тенис");
    await renameGroup(group.id, "  Теннис  ");
    expect(await groupName(group.id)).toBe("Теннис");
  });
});

describe("deleteGroup", () => {
  it("removes the group but keeps its contacts and their other groups", async () => {
    const family = await addGroup("Семья");
    const tennis = await addGroup("Теннис");
    const boris = await addContact("Борис");
    const vera = await addContact("Вера");
    await setContactGroups(boris.id, [tennis.id]);
    await setContactGroups(vera.id, [family.id, tennis.id]);

    await deleteGroup(tennis.id);

    expect((await listGroups()).map((g) => g.name)).toEqual(["Семья"]);
    expect(await db.$count(contacts)).toBe(2);
    expect(await groupNamesOf(boris.id)).toEqual([]);
    expect(await groupNamesOf(vera.id)).toEqual(["Семья"]);
  });
});
