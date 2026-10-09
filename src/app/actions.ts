"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { contacts, notes } from "@/db/schema";

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

export async function createContact(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const name = clean(formData.get("name"));
  if (!name) {
    return { ok: false, error: "Укажите имя контакта" };
  }

  const [row] = await db
    .insert(contacts)
    .values({
      name,
      howWeMet: clean(formData.get("howWeMet")),
      phone: clean(formData.get("phone")),
      email: clean(formData.get("email")),
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

  await db
    .update(contacts)
    .set({
      name,
      howWeMet: clean(formData.get("howWeMet")),
      phone: clean(formData.get("phone")),
      email: clean(formData.get("email")),
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, id));

  revalidatePath("/");
  revalidatePath(`/contacts/${id}`);
  return { ok: true, contactId: id };
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
