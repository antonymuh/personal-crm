import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db, type Executor } from "@/db";
import { contactGroups, contacts, groups, type Group } from "@/db/schema";
import { GROUP_NAME_TAKEN, parseGroupName } from "@/lib/groups";

// Every function works only with the given user's groups: another user's
// group behaves as if it did not exist.

export type GroupResult = { ok: true } | { ok: false; error: string };

const GROUP_NOT_FOUND = "Группа не найдена";

const sameName = (name: string) =>
  eq(sql`lower(${groups.name})`, sql`lower(${name})`);

const ownGroup = (userId: string, id: number) =>
  and(eq(groups.id, id), eq(groups.userId, userId));

function isUniqueViolation(err: unknown): boolean {
  const code = (e: unknown) =>
    typeof e === "object" && e !== null && "code" in e ? e.code : undefined;
  return (
    code(err) === "23505" ||
    (err instanceof Error && code(err.cause) === "23505")
  );
}

// The user's groups, alphabetically (case does not matter).
export async function listGroups(
  userId: string,
  executor: Executor = db
): Promise<Group[]> {
  return executor
    .select()
    .from(groups)
    .where(eq(groups.userId, userId))
    .orderBy(asc(sql`lower(${groups.name})`), asc(groups.id));
}

// Returns the user's group with this name, creating it if there is none yet.
// ON CONFLICT keeps two simultaneous saves from creating a duplicate.
export async function findOrCreateGroup(
  userId: string,
  name: string,
  executor: Executor = db
): Promise<Group> {
  await executor.insert(groups).values({ userId, name }).onConflictDoNothing();
  const [group] = await executor
    .select()
    .from(groups)
    .where(and(eq(groups.userId, userId), sameName(name)));
  return group;
}

// Replaces the contact's groups with the given ones. Ids of groups that are
// not the user's (deleted in another tab, or someone else's) are silently
// dropped; another user's contact is left untouched.
export async function setContactGroups(
  userId: string,
  contactId: number,
  groupIds: number[],
  executor: Executor = db
): Promise<void> {
  const [own] = await executor
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.userId, userId)));
  if (!own) return;

  await executor
    .delete(contactGroups)
    .where(eq(contactGroups.contactId, contactId));
  if (groupIds.length === 0) return;
  await executor.insert(contactGroups).select(
    executor
      .select({
        contactId: sql<number>`${contactId}::int`.as("contact_id"),
        groupId: groups.id,
      })
      .from(groups)
      .where(and(eq(groups.userId, userId), inArray(groups.id, groupIds)))
  );
}

export async function renameGroup(
  userId: string,
  id: number,
  rawName: unknown,
  executor: Executor = db
): Promise<GroupResult> {
  const parsed = parseGroupName(rawName);
  if (!parsed.ok) return parsed;

  try {
    const updated = await executor
      .update(groups)
      .set({ name: parsed.name })
      .where(ownGroup(userId, id))
      .returning({ id: groups.id });
    return updated.length > 0
      ? { ok: true }
      : { ok: false, error: GROUP_NOT_FOUND };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: GROUP_NAME_TAKEN };
    throw err;
  }
}

// Removes only the group; its contacts stay (memberships go by ON DELETE CASCADE).
export async function deleteGroup(
  userId: string,
  id: number,
  executor: Executor = db
): Promise<GroupResult> {
  const deleted = await executor
    .delete(groups)
    .where(ownGroup(userId, id))
    .returning({ id: groups.id });
  return deleted.length > 0
    ? { ok: true }
    : { ok: false, error: GROUP_NOT_FOUND };
}
