import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { contacts, notes, type User } from "@/db/schema";
import {
  addNote,
  deleteContact,
  getContact,
  listNotes,
  markContacted,
} from "@/db/contacts";
import { addContact, addUser, resetDatabase } from "../../test/db";

let me: User;
let other: User;

beforeEach(async () => {
  await resetDatabase();
  me = await addUser("anna@example.com");
  other = await addUser("boris@example.com");
});

async function contactRow(id: number) {
  const [row] = await db.select().from(contacts).where(eq(contacts.id, id));
  return row;
}

describe("getContact", () => {
  it("returns the user's contact with its keep-in-touch fields", async () => {
    const contact = await addContact(me.id, "Вера");
    expect(await getContact(me.id, contact.id)).toMatchObject({
      id: contact.id,
      name: "Вера",
      isDue: false,
      dueAt: null,
    });
  });

  it("does not find another user's contact", async () => {
    const theirs = await addContact(other.id, "Вера");
    expect(await getContact(me.id, theirs.id)).toBeNull();
  });
});

describe("listNotes", () => {
  it("returns the contact's notes, newest first", async () => {
    const contact = await addContact(me.id, "Вера");
    await db.insert(notes).values([
      {
        contactId: contact.id,
        body: "Старая",
        createdAt: new Date(2026, 0, 1),
      },
      { contactId: contact.id, body: "Новая", createdAt: new Date(2026, 5, 1) },
    ]);
    const rows = await listNotes(me.id, contact.id);
    expect(rows.map((n) => n.body)).toEqual(["Новая", "Старая"]);
  });

  it("returns nothing for another user's contact", async () => {
    const theirs = await addContact(other.id, "Вера");
    await db.insert(notes).values({ contactId: theirs.id, body: "Секрет" });
    expect(await listNotes(me.id, theirs.id)).toEqual([]);
  });
});

describe("deleteContact", () => {
  it("deletes the user's contact", async () => {
    const contact = await addContact(me.id, "Вера");
    expect(await deleteContact(me.id, contact.id)).toBe(true);
    expect(await db.$count(contacts)).toBe(0);
  });

  it("leaves another user's contact alone", async () => {
    const theirs = await addContact(other.id, "Вера");
    expect(await deleteContact(me.id, theirs.id)).toBe(false);
    expect(await contactRow(theirs.id)).toBeDefined();
  });
});

describe("addNote", () => {
  it("adds a note to the user's contact", async () => {
    const contact = await addContact(me.id, "Вера");
    expect(await addNote(me.id, contact.id, "Созвонились")).toBe(true);
    expect((await listNotes(me.id, contact.id)).map((n) => n.body)).toEqual([
      "Созвонились",
    ]);
  });

  it("does not add a note to another user's contact", async () => {
    const theirs = await addContact(other.id, "Вера");
    const before = await contactRow(theirs.id);

    expect(await addNote(me.id, theirs.id, "Чужая заметка")).toBe(false);

    expect(await db.$count(notes)).toBe(0);
    expect((await contactRow(theirs.id)).updatedAt).toEqual(before.updatedAt);
  });
});

describe("markContacted", () => {
  it("sets the last contact moment of the user's contact", async () => {
    const contact = await addContact(me.id, "Вера");
    expect(await markContacted(me.id, contact.id)).toBe(true);
    expect((await contactRow(contact.id)).lastContactedAt).not.toBeNull();
  });

  it("does not touch another user's contact", async () => {
    const theirs = await addContact(other.id, "Вера");
    expect(await markContacted(me.id, theirs.id)).toBe(false);
    expect((await contactRow(theirs.id)).lastContactedAt).toBeNull();
  });
});
