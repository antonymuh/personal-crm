import { asc, sql } from "drizzle-orm";

import { contacts } from "./schema";
import { CONTACT_FREQUENCIES } from "@/lib/contact-frequency";

// The "time to get in touch" rule lives here, in SQL, so the list, its sort
// order and the contact page can never disagree.

const frequencyInterval = sql.join(
  [
    sql`case ${contacts.contactFrequency}`,
    ...CONTACT_FREQUENCIES.map(
      (f) => sql`when ${f.value} then interval '${sql.raw(f.interval)}'`
    ),
    sql`end`,
  ],
  sql` `
);

// When the next conversation is due; NULL if no frequency or never contacted.
export const dueAt = sql<Date | null>`(${contacts.lastContactedAt} + ${frequencyInterval})`.mapWith(
  contacts.lastContactedAt
);

// A frequency is set and either we never talked or the period has passed.
export const isDue = sql<boolean>`(${contacts.contactFrequency} is not null and (${contacts.lastContactedAt} is null or ${dueAt} <= now()))`.mapWith(
  Boolean
);

// Due contacts first: never contacted, then the longest overdue; the rest by name.
export const keepInTouchOrder = [
  sql`case when ${isDue} then (case when ${contacts.lastContactedAt} is null then 0 else 1 end) else 2 end`,
  sql`case when ${isDue} then ${dueAt} end asc nulls last`,
  asc(contacts.name),
];
