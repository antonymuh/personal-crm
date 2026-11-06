import { and, eq } from "drizzle-orm";

import { db, type Executor } from "@/db";
import { contacts } from "@/db/schema";
import { findOrCreateGroup, setContactGroups } from "@/db/groups";
import { clean } from "@/lib/form";
import { cleanGroupName, parseGroupIds } from "@/lib/groups";
import {
  isContactFrequency,
  type ContactFrequency,
} from "@/lib/contact-frequency";

// Saving the "add contact" / "edit contact" forms: the contact itself, its
// checked groups and an optional new group, all in one transaction. A user
// creates and changes only their own contacts and groups.

export type ContactFormResult =
  { ok: true; contactId: number } | { ok: false; error: string };

const NAME_REQUIRED = "Укажите имя контакта";
const UNKNOWN_FREQUENCY = "Неизвестная частота общения";
const CONTACT_NOT_FOUND = "Контакт не найден";

type ContactForm = {
  fields: {
    name: string;
    howWeMet: string | null;
    phone: string | null;
    email: string | null;
    contactFrequency: ContactFrequency | null;
  };
  groupIds: number[];
  newGroupName: string | null;
};

// Everything is checked before the transaction, so a form error writes nothing.
function parseContactForm(
  formData: FormData
): { ok: true; form: ContactForm } | { ok: false; error: string } {
  const name = clean(formData.get("name"));
  if (!name) return { ok: false, error: NAME_REQUIRED };

  // Empty means "not set"; anything else must be a known frequency.
  const frequency = clean(formData.get("contactFrequency"));
  if (frequency !== null && !isContactFrequency(frequency)) {
    return { ok: false, error: UNKNOWN_FREQUENCY };
  }

  return {
    ok: true,
    form: {
      fields: {
        name,
        howWeMet: clean(formData.get("howWeMet")),
        phone: clean(formData.get("phone")),
        email: clean(formData.get("email")),
        contactFrequency: frequency,
      },
      groupIds: parseGroupIds(formData.getAll("groupIds")),
      newGroupName: cleanGroupName(formData.get("newGroup")),
    },
  };
}

async function saveGroups(
  tx: Executor,
  userId: string,
  contactId: number,
  form: ContactForm
): Promise<void> {
  const groupIds = new Set(form.groupIds);
  if (form.newGroupName) {
    const group = await findOrCreateGroup(userId, form.newGroupName, tx);
    groupIds.add(group.id);
  }
  await setContactGroups(userId, contactId, [...groupIds], tx);
}

export async function createContactFromForm(
  userId: string,
  formData: FormData,
  executor: Executor = db
): Promise<ContactFormResult> {
  const parsed = parseContactForm(formData);
  if (!parsed.ok) return parsed;
  const { form } = parsed;

  return executor.transaction(async (tx) => {
    const [row] = await tx
      .insert(contacts)
      .values({ ...form.fields, userId })
      .returning({ id: contacts.id });
    await saveGroups(tx, userId, row.id, form);
    return { ok: true, contactId: row.id };
  });
}

// Another user's contact is reported as missing and left untouched.
export async function updateContactFromForm(
  userId: string,
  formData: FormData,
  executor: Executor = db
): Promise<ContactFormResult> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { ok: false, error: CONTACT_NOT_FOUND };
  const parsed = parseContactForm(formData);
  if (!parsed.ok) return parsed;
  const { form } = parsed;

  return executor.transaction(async (tx) => {
    const updated = await tx
      .update(contacts)
      .set({ ...form.fields, updatedAt: new Date() })
      .where(and(eq(contacts.id, id), eq(contacts.userId, userId)))
      .returning({ id: contacts.id });
    if (updated.length === 0) return { ok: false, error: CONTACT_NOT_FOUND };
    await saveGroups(tx, userId, id, form);
    return { ok: true, contactId: id };
  });
}
