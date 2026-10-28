import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { contactGroups, contacts, groups } from "@/db/schema";
import { resetDatabase } from "../../test/db";

beforeEach(resetDatabase);

async function contactInGroup(contactName: string, groupName: string) {
  const [contact] = await db
    .insert(contacts)
    .values({ name: contactName })
    .returning();
  const [group] = await db
    .insert(groups)
    .values({ name: groupName })
    .returning();
  await db
    .insert(contactGroups)
    .values({ contactId: contact.id, groupId: group.id });
  return { contact, group };
}

describe("groups schema", () => {
  it("stores groups and memberships", async () => {
    const { contact, group } = await contactInGroup("Анна", "Семья");
    const rows = await db.select().from(contactGroups);
    expect(rows).toEqual([{ contactId: contact.id, groupId: group.id }]);
  });

  it("rejects a group name that differs only in case", async () => {
    await db.insert(groups).values({ name: "Теннис" });
    await expect(
      db.insert(groups).values({ name: "теннис" })
    ).rejects.toThrow();
    expect(await db.$count(groups)).toBe(1);
  });

  it("keeps the group when its only contact is deleted", async () => {
    const { contact, group } = await contactInGroup("Аня", "Аналитики");
    await db.delete(contacts).where(eq(contacts.id, contact.id));

    expect(await db.$count(contactGroups)).toBe(0);
    const left = await db.select().from(groups);
    expect(left.map((g) => g.id)).toEqual([group.id]);
  });

  it("keeps the contacts when a group is deleted", async () => {
    const { contact, group } = await contactInGroup("Борис", "Теннис");
    await db.delete(groups).where(eq(groups.id, group.id));

    expect(await db.$count(contactGroups)).toBe(0);
    const left = await db.select().from(contacts);
    expect(left.map((c) => c.id)).toEqual([contact.id]);
  });
});
