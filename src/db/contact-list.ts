import { and, asc, eq, ilike, sql } from "drizzle-orm";

import { db, type Executor } from "@/db";
import { contactGroups, contacts, groups, notes } from "@/db/schema";
import { isDue, keepInTouchOrder } from "@/db/keep-in-touch";

export type ContactListRow = {
  id: number;
  name: string;
  howWeMet: string | null;
  phone: string | null;
  email: string | null;
  noteCount: number;
  isDue: boolean;
  groupNames: string[];
};

// The outer id is qualified by hand: in a single-table select Drizzle drops
// table names, and a bare "id" inside a subquery would mean the inner table's id.
const contactId = sql`${contacts}.${sql.identifier(contacts.id.name)}`;

const noteCount = sql<number>`(select count(*)::int from ${notes} where ${notes.contactId} = ${contactId})`;

// Names of the contact's groups, alphabetically; an empty list if none.
const groupNames = sql<string[]>`coalesce((
  select json_agg(g.name order by lower(g.name), g.id)
  from ${contactGroups} cg join ${groups} g on g.id = cg.group_id
  where cg.contact_id = ${contactId}
), '[]'::json)`;

const inGroup = (groupId: number) =>
  sql`exists (select 1 from ${contactGroups} cg where cg.contact_id = ${contactId} and cg.group_id = ${groupId})`;

// The home page list. Note counts and group labels come from the same query,
// so the database is hit once even with a thousand contacts.
export async function listContacts(
  { query, groupId }: { query: string; groupId: number | null },
  executor: Executor = db
): Promise<ContactListRow[]> {
  return executor
    .select({
      id: contacts.id,
      name: contacts.name,
      howWeMet: contacts.howWeMet,
      phone: contacts.phone,
      email: contacts.email,
      noteCount,
      isDue,
      groupNames,
    })
    .from(contacts)
    .where(
      and(
        query ? ilike(contacts.name, `%${query}%`) : undefined,
        groupId !== null ? inGroup(groupId) : undefined
      )
    )
    // Contacts it is time to get in touch with come first.
    .orderBy(...keepInTouchOrder);
}

// The contact's groups, alphabetically: labels on the contact page and the
// checked boxes in the edit form.
export async function getContactGroups(
  id: number,
  executor: Executor = db
): Promise<{ id: number; name: string }[]> {
  return executor
    .select({ id: groups.id, name: groups.name })
    .from(contactGroups)
    .innerJoin(groups, eq(groups.id, contactGroups.groupId))
    .where(eq(contactGroups.contactId, id))
    .orderBy(asc(sql`lower(${groups.name})`), asc(groups.id));
}
