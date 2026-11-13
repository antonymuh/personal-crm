import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  date,
  boolean,
  index,
  uniqueIndex,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Sign-in tables in the shape Better Auth expects (see src/lib/auth.ts).
// The JS property names are the field names Better Auth uses.

// A person who has signed in at least once. The first sign-in creates the row.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // Stored trimmed and lowercased, so one address is always one user.
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// One signed-in device. Sign-out deletes only the row of that device.
export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)]
);

// Required by Better Auth; with sign-in links only it holds no passwords.
export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("account_user_id_idx").on(table.userId)]
);

// Sign-in links that have not been used yet. The link is deleted when opened.
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

// When a sign-in email went to which address: the "3 emails per 10 minutes"
// limit is counted from here (see src/db/sign-in-emails.ts).
export const signInEmails = pgTable(
  "sign_in_emails",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sign_in_emails_email_idx").on(table.email, table.sentAt)]
);

// People I know personally. One row per contact.
export const contacts = pgTable(
  "contacts",
  {
    id: serial("id").primaryKey(),
    // Whose contact this is; nobody else sees or changes it.
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Where / how I know this person from.
    howWeMet: text("how_we_met"),
    phone: text("phone"),
    email: text("email"),
    // Day of birth as "YYYY-MM-DD" (no time, no time zone); NULL means "not set".
    birthDate: date("birth_date", { mode: "string" }),
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
    index("contacts_user_id_name_idx").on(table.userId, table.name),
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

// Groups a user sorts their contacts into (family, friends, tennis...). Names
// are unique per user regardless of case: "Теннис" and "теннис" are the same
// group, but two users may both have "Друзья".
export const groups = pgTable(
  "groups",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("groups_user_id_name_lower_idx").on(
      table.userId,
      sql`lower(${table.name})`
    ),
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

export type User = typeof user.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type ContactGroup = typeof contactGroups.$inferSelect;
