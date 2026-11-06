import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { contacts, groups, type User } from "@/db/schema";
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

async function groupName(id: number) {
  const [row] = await db.select().from(groups).where(eq(groups.id, id));
  return row?.name;
}

describe("listGroups", () => {
  it("is empty at first", async () => {
    expect(await listGroups(me.id)).toEqual([]);
  });

  it("lists groups alphabetically", async () => {
    await addGroup(me.id, "Теннис");
    await addGroup(me.id, "Друзья");
    await addGroup(me.id, "аналитики");
    const names = (await listGroups(me.id)).map((g) => g.name);
    expect(names).toEqual(["аналитики", "Друзья", "Теннис"]);
  });

  it("lists only the user's own groups", async () => {
    await addGroup(me.id, "Семья");
    await addGroup(other.id, "Теннис");
    expect((await listGroups(me.id)).map((g) => g.name)).toEqual(["Семья"]);
    expect((await listGroups(other.id)).map((g) => g.name)).toEqual(["Теннис"]);
  });
});

describe("findOrCreateGroup", () => {
  it("creates a new group owned by the user", async () => {
    const group = await findOrCreateGroup(me.id, "Семья");
    expect(group).toMatchObject({ name: "Семья", userId: me.id });
    expect((await listGroups(me.id)).map((g) => g.id)).toEqual([group.id]);
  });

  it("finds an existing group regardless of case", async () => {
    const tennis = await addGroup(me.id, "Теннис");
    const found = await findOrCreateGroup(me.id, "теннис");
    expect(found).toMatchObject({ id: tennis.id, name: "Теннис" });
    expect(await db.$count(groups)).toBe(1);
  });

  it("creates its own group when another user has one with that name", async () => {
    const theirs = await addGroup(other.id, "Друзья");
    const mine = await findOrCreateGroup(me.id, "друзья");
    expect(mine.id).not.toBe(theirs.id);
    expect(mine).toMatchObject({ name: "друзья", userId: me.id });
    expect(await groupName(theirs.id)).toBe("Друзья");
  });
});

describe("setContactGroups", () => {
  it("puts a contact into several groups", async () => {
    const contact = await addContact(me.id, "Вера");
    const friends = await addGroup(me.id, "Друзья");
    const tennis = await addGroup(me.id, "Теннис");

    await setContactGroups(me.id, contact.id, [friends.id, tennis.id]);

    expect(await groupNamesOf(contact.id)).toEqual(["Друзья", "Теннис"]);
  });

  it("removes a contact from an unchecked group but keeps the group", async () => {
    const contact = await addContact(me.id, "Вера");
    const friends = await addGroup(me.id, "Друзья");
    const tennis = await addGroup(me.id, "Теннис");
    await setContactGroups(me.id, contact.id, [friends.id, tennis.id]);

    await setContactGroups(me.id, contact.id, [friends.id]);

    expect(await groupNamesOf(contact.id)).toEqual(["Друзья"]);
    expect(await groupName(tennis.id)).toBe("Теннис");
  });

  it("leaves a contact without groups", async () => {
    const contact = await addContact(me.id, "Анна");
    const friends = await addGroup(me.id, "Друзья");
    await setContactGroups(me.id, contact.id, [friends.id]);

    await setContactGroups(me.id, contact.id, []);

    expect(await groupNamesOf(contact.id)).toEqual([]);
  });

  it("silently drops a group that no longer exists", async () => {
    const contact = await addContact(me.id, "Анна");
    const friends = await addGroup(me.id, "Друзья");
    const gone = await addGroup(me.id, "Старая");
    await db.delete(groups).where(eq(groups.id, gone.id));

    await setContactGroups(me.id, contact.id, [friends.id, gone.id]);

    expect(await groupNamesOf(contact.id)).toEqual(["Друзья"]);
  });

  it("silently drops another user's group", async () => {
    const contact = await addContact(me.id, "Анна");
    const friends = await addGroup(me.id, "Друзья");
    const theirs = await addGroup(other.id, "Теннис");

    await setContactGroups(me.id, contact.id, [friends.id, theirs.id]);

    expect(await groupNamesOf(contact.id)).toEqual(["Друзья"]);
  });

  it("does not change another user's contact", async () => {
    const theirs = await addContact(other.id, "Борис");
    const family = await addGroup(other.id, "Семья");
    await setContactGroups(other.id, theirs.id, [family.id]);

    await setContactGroups(me.id, theirs.id, []);

    expect(await groupNamesOf(theirs.id)).toEqual(["Семья"]);
  });

  it("does not touch other contacts' groups", async () => {
    const anna = await addContact(me.id, "Анна");
    const boris = await addContact(me.id, "Борис");
    const family = await addGroup(me.id, "Семья");
    await setContactGroups(me.id, anna.id, [family.id]);

    await setContactGroups(me.id, boris.id, []);

    expect(await groupNamesOf(anna.id)).toEqual(["Семья"]);
  });
});

describe("renameGroup", () => {
  it("renames a group and keeps its contacts", async () => {
    const group = await addGroup(me.id, "Тенис");
    const boris = await addContact(me.id, "Борис");
    const vera = await addContact(me.id, "Вера");
    await setContactGroups(me.id, boris.id, [group.id]);
    await setContactGroups(me.id, vera.id, [group.id]);

    expect(await renameGroup(me.id, group.id, "Теннис")).toEqual({ ok: true });

    expect(await groupName(group.id)).toBe("Теннис");
    expect(await groupNamesOf(boris.id)).toEqual(["Теннис"]);
    expect(await groupNamesOf(vera.id)).toEqual(["Теннис"]);
  });

  it("refuses a name that another group already has", async () => {
    await addGroup(me.id, "Друзья");
    const family = await addGroup(me.id, "Семья");

    expect(await renameGroup(me.id, family.id, "друзья")).toEqual({
      ok: false,
      error: "Группа с таким названием уже есть",
    });
    expect(await groupName(family.id)).toBe("Семья");
  });

  it("allows a name that only another user's group has", async () => {
    await addGroup(other.id, "Друзья");
    const family = await addGroup(me.id, "Семья");
    expect(await renameGroup(me.id, family.id, "Друзья")).toEqual({
      ok: true,
    });
  });

  it("allows changing only the case", async () => {
    const group = await addGroup(me.id, "теннис");
    expect(await renameGroup(me.id, group.id, "Теннис")).toEqual({ ok: true });
    expect(await groupName(group.id)).toBe("Теннис");
  });

  it("refuses an empty name", async () => {
    const group = await addGroup(me.id, "Теннис");
    expect(await renameGroup(me.id, group.id, "   ")).toEqual({
      ok: false,
      error: "Укажите название группы",
    });
    expect(await groupName(group.id)).toBe("Теннис");
  });

  it("trims spaces around the new name", async () => {
    const group = await addGroup(me.id, "Тенис");
    await renameGroup(me.id, group.id, "  Теннис  ");
    expect(await groupName(group.id)).toBe("Теннис");
  });

  it("treats another user's group as not found", async () => {
    const theirs = await addGroup(other.id, "Теннис");
    expect(await renameGroup(me.id, theirs.id, "Моя")).toEqual({
      ok: false,
      error: "Группа не найдена",
    });
    expect(await groupName(theirs.id)).toBe("Теннис");
  });
});

describe("deleteGroup", () => {
  it("removes the group but keeps its contacts and their other groups", async () => {
    const family = await addGroup(me.id, "Семья");
    const tennis = await addGroup(me.id, "Теннис");
    const boris = await addContact(me.id, "Борис");
    const vera = await addContact(me.id, "Вера");
    await setContactGroups(me.id, boris.id, [tennis.id]);
    await setContactGroups(me.id, vera.id, [family.id, tennis.id]);

    expect(await deleteGroup(me.id, tennis.id)).toEqual({ ok: true });

    expect((await listGroups(me.id)).map((g) => g.name)).toEqual(["Семья"]);
    expect(await db.$count(contacts)).toBe(2);
    expect(await groupNamesOf(boris.id)).toEqual([]);
    expect(await groupNamesOf(vera.id)).toEqual(["Семья"]);
  });

  it("treats another user's group as not found", async () => {
    const theirs = await addGroup(other.id, "Теннис");
    expect(await deleteGroup(me.id, theirs.id)).toEqual({
      ok: false,
      error: "Группа не найдена",
    });
    expect(await groupName(theirs.id)).toBe("Теннис");
  });
});
