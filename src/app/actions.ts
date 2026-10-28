"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { contacts, notes } from "@/db/schema";
import {
  createContactFromForm,
  updateContactFromForm,
} from "@/db/contact-form";
import {
  deleteGroup as deleteGroupRow,
  renameGroup as renameGroupRow,
} from "@/db/groups";
import { clean } from "@/lib/form";

export type ActionResult = {
  ok: boolean;
  error?: string;
  contactId?: number;
};

export async function createContact(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const result = await createContactFromForm(formData);
  if (result.ok) revalidatePath("/");
  return result;
}

export async function updateContact(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const result = await updateContactFromForm(formData);
  if (result.ok) {
    revalidatePath("/");
    revalidatePath(`/contacts/${result.contactId}`);
  }
  return result;
}

// Permanently removes the contact; its notes go with it (ON DELETE CASCADE).
export async function deleteContact(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) {
    return { ok: false, error: "Контакт не найден" };
  }

  await db.delete(contacts).where(eq(contacts.id, id));

  revalidatePath("/");
  redirect("/");
}

export async function addNote(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const contactId = Number(formData.get("contactId"));
  if (!Number.isInteger(contactId)) {
    return { ok: false, error: "Контакт не найден" };
  }
  const body = clean(formData.get("body"));
  if (!body) {
    return { ok: false, error: "Заметка не может быть пустой" };
  }

  await db.insert(notes).values({ contactId, body });
  // Touch the contact so "last activity" reflects the new note.
  await db
    .update(contacts)
    .set({ updatedAt: new Date() })
    .where(eq(contacts.id, contactId));

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/");
  return { ok: true, contactId };
}

// "We talked": sets the last contact moment to now, using the database clock.
export async function markContacted(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const contactId = Number(formData.get("contactId"));
  if (!Number.isInteger(contactId)) {
    return { ok: false, error: "Контакт не найден" };
  }

  await db
    .update(contacts)
    .set({ lastContactedAt: sql`now()` })
    .where(eq(contacts.id, contactId));

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/");
  return { ok: true, contactId };
}

export async function renameGroup(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) {
    return { ok: false, error: "Группа не найдена" };
  }

  const result = await renameGroupRow(id, formData.get("name"));
  // The name shows up in the filter, the forms and every contact's labels.
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

// Removes only the group; its contacts stay. Shows the whole list afterwards.
export async function deleteGroup(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) {
    return { ok: false, error: "Группа не найдена" };
  }

  await deleteGroupRow(id);

  revalidatePath("/", "layout");
  redirect("/");
}
