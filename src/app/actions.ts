"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { contacts, notes } from "@/db/schema";
import {
  isContactFrequency,
  type ContactFrequency,
} from "@/lib/contact-frequency";

export type ActionResult = {
  ok: boolean;
  error?: string;
  contactId?: number;
};

function clean(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const UNKNOWN_FREQUENCY = "Неизвестная частота общения";

// Empty means "not set"; anything else must be a known frequency.
function parseFrequency(
  value: FormDataEntryValue | null
): { ok: true; value: ContactFrequency | null } | { ok: false } {
  const cleaned = clean(value);
  if (cleaned === null) return { ok: true, value: null };
  return isContactFrequency(cleaned)
    ? { ok: true, value: cleaned }
    : { ok: false };
}

export async function createContact(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const name = clean(formData.get("name"));
  if (!name) {
    return { ok: false, error: "Укажите имя контакта" };
  }
  const frequency = parseFrequency(formData.get("contactFrequency"));
  if (!frequency.ok) {
    return { ok: false, error: UNKNOWN_FREQUENCY };
  }

  const [row] = await db
    .insert(contacts)
    .values({
      name,
      howWeMet: clean(formData.get("howWeMet")),
      phone: clean(formData.get("phone")),
      email: clean(formData.get("email")),
      contactFrequency: frequency.value,
    })
    .returning({ id: contacts.id });

  revalidatePath("/");
  return { ok: true, contactId: row.id };
}

export async function updateContact(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) {
    return { ok: false, error: "Контакт не найден" };
  }
  const name = clean(formData.get("name"));
  if (!name) {
    return { ok: false, error: "Укажите имя контакта" };
  }
  const frequency = parseFrequency(formData.get("contactFrequency"));
  if (!frequency.ok) {
    return { ok: false, error: UNKNOWN_FREQUENCY };
  }

  await db
    .update(contacts)
    .set({
      name,
      howWeMet: clean(formData.get("howWeMet")),
      phone: clean(formData.get("phone")),
      email: clean(formData.get("email")),
      contactFrequency: frequency.value,
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, id));

  revalidatePath("/");
  revalidatePath(`/contacts/${id}`);
  return { ok: true, contactId: id };
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
