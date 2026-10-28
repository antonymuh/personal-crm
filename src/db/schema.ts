import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// People I know personally. One row per contact.
export const contacts = pgTable(
  "contacts",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    // Where / how I know this person from.
    howWeMet: text("how_we_met"),
    phone: text("phone"),
    email: text("email"),
    // How often I want to be in touch; NULL means "not set".
    // Allowed values live in src/db/keep-in-touch.ts.
    contactFrequency: text("contact_frequency"),
    // When I last talked to this person; NULL means "never marked".
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("contacts_name_idx").on(table.name),
    check(
      "contacts_contact_frequency_check",
      sql`${table.contactFrequency} in ('week', 'two_weeks', 'month', 'quarter', 'half_year', 'year')`
    ),
  ]
);

// Timeline of notes attached to a contact (e.g. what we agreed on after a call).
export const notes = pgTable(
  "notes",
  {
    id: serial("id").primaryKey(),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("notes_contact_id_idx").on(table.contactId)]
);

// Groups I sort contacts into (family, friends, tennis...). Names are unique
// regardless of case: "Теннис" and "теннис" are the same group.
export const groups = pgTable(
  "groups",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("groups_name_lower_idx").on(sql`lower(${table.name})`),
  ]
);

// Which contact is in which group. Deleting a contact or a group removes only
// the membership, never the other side.
export const contactGroups = pgTable(
  "contact_groups",
  {
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.contactId, table.groupId] }),
    // The primary key covers lookups by contact; this one serves the group filter.
    index("contact_groups_group_id_idx").on(table.groupId),
  ]
);

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type ContactGroup = typeof contactGroups.$inferSelect;
