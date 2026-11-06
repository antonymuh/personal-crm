import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";

import { db, type Executor } from "@/db";
import { contacts, notes, type Note } from "@/db/schema";
import { dueAt, isDue } from "@/db/keep-in-touch";

// One contact of the user and what happens to it on its page. Another user's
// contact behaves as if it did not exist: nothing is found, nothing changes.

const ownContact = (userId: string, id: number) =>
  and(eq(contacts.id, id), eq(contacts.userId, userId));

export async function getContact(
  userId: string,
  id: number,
  executor: Executor = db
) {
  const [contact] = await executor
    .select({ ...getTableColumns(contacts), dueAt, isDue })
    .from(contacts)
    .where(ownContact(userId, id))
    .limit(1);
  return contact ?? null;
}

// The contact's notes, newest first.
export async function listNotes(
  userId: string,
  contactId: number,
  executor: Executor = db
): Promise<Note[]> {
  return executor
    .select(getTableColumns(notes))
    .from(notes)
    .innerJoin(contacts, eq(contacts.id, notes.contactId))
    .where(ownContact(userId, contactId))
    .orderBy(desc(notes.createdAt));
}

// Permanently removes the contact; its notes go with it (ON DELETE CASCADE).
// Returns false if the user has no such contact.
export async function deleteContact(
  userId: string,
  id: number,
  executor: Executor = db
): Promise<boolean> {
  const deleted = await executor
    .delete(contacts)
    .where(ownContact(userId, id))
    .returning({ id: contacts.id });
  return deleted.length > 0;
}

// Returns false if the user has no such contact.
export async function addNote(
  userId: string,
  contactId: number,
  body: string,
  executor: Executor = db
): Promise<boolean> {
  return executor.transaction(async (tx) => {
    // Touch the contact so "last activity" reflects the new note.
    const touched = await tx
      .update(contacts)
      .set({ updatedAt: new Date() })
      .where(ownContact(userId, contactId))
      .returning({ id: contacts.id });
    if (touched.length === 0) return false;
    await tx.insert(notes).values({ contactId, body });
    return true;
  });
}

// "We talked": sets the last contact moment to now, using the database clock.
// Returns false if the user has no such contact.
export async function markContacted(
  userId: string,
  contactId: number,
  executor: Executor = db
): Promise<boolean> {
  const updated = await executor
    .update(contacts)
    .set({ lastContactedAt: sql`now()` })
    .where(ownContact(userId, contactId))
    .returning({ id: contacts.id });
  return updated.length > 0;
}
