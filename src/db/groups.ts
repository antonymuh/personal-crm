import { asc, eq, inArray, sql } from "drizzle-orm";

import { db, type Executor } from "@/db";
import { contactGroups, groups, type Group } from "@/db/schema";
import { GROUP_NAME_TAKEN, parseGroupName } from "@/lib/groups";

export type GroupResult = { ok: true } | { ok: false; error: string };

const GROUP_NOT_FOUND = "Группа не найдена";

const sameName = (name: string) =>
  eq(sql`lower(${groups.name})`, sql`lower(${name})`);

function isUniqueViolation(err: unknown): boolean {
  const code = (e: unknown) =>
    typeof e === "object" && e !== null && "code" in e ? e.code : undefined;
  return (
    code(err) === "23505" ||
    (err instanceof Error && code(err.cause) === "23505")
  );
}

// All groups, alphabetically (case does not matter).
export async function listGroups(executor: Executor = db): Promise<Group[]> {
  return executor
    .select()
    .from(groups)
    .orderBy(asc(sql`lower(${groups.name})`), asc(groups.id));
}

// Returns the group with this name, creating it if there is none yet.
// ON CONFLICT keeps two simultaneous saves from creating a duplicate.
export async function findOrCreateGroup(
  name: string,
  executor: Executor = db
): Promise<Group> {
  await executor.insert(groups).values({ name }).onConflictDoNothing();
  const [group] = await executor.select().from(groups).where(sameName(name));
  return group;
}

// Replaces the contact's groups with the given ones. Ids of groups that no
// longer exist (deleted in another tab) are silently dropped.
export async function setContactGroups(
  contactId: number,
  groupIds: number[],
  executor: Executor = db
): Promise<void> {
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
      .where(inArray(groups.id, groupIds))
  );
}

export async function renameGroup(
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
      .where(eq(groups.id, id))
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
  id: number,
  executor: Executor = db
): Promise<void> {
  await executor.delete(groups).where(eq(groups.id, id));
}
