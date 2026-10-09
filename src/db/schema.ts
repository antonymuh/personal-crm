import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("contacts_name_idx").on(table.name)]
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

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
