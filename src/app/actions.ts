"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createContactFromForm,
  updateContactFromForm,
} from "@/db/contact-form";
import {
  addNote as addNoteRow,
  deleteContact as deleteContactRow,
  markContacted as markContactedRow,
} from "@/db/contacts";
import {
  deleteGroup as deleteGroupRow,
  renameGroup as renameGroupRow,
} from "@/db/groups";
import { clean } from "@/lib/form";
import { requireUser } from "@/lib/session";

// Every action first checks the session (no session: the sign-in page, nothing
// changes) and then touches only the signed-in user's data.

export type ActionResult = {
  ok: boolean;
  error?: string;
  contactId?: number;
};

const CONTACT_NOT_FOUND = "Контакт не найден";
const GROUP_NOT_FOUND = "Группа не найдена";

export async function createContact(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireUser();
  const result = await createContactFromForm(user.id, formData);
  if (result.ok) revalidatePath("/");
  return result;
}

export async function updateContact(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireUser();
  const result = await updateContactFromForm(user.id, formData);
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
  const user = await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) {
    return { ok: false, error: CONTACT_NOT_FOUND };
  }

  // Already gone or not the user's: the list is the right place either way.
  await deleteContactRow(user.id, id);

  revalidatePath("/");
  redirect("/");
}

export async function addNote(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireUser();
  const contactId = Number(formData.get("contactId"));
  if (!Number.isInteger(contactId)) {
    return { ok: false, error: CONTACT_NOT_FOUND };
  }
  const body = clean(formData.get("body"));
  if (!body) {
    return { ok: false, error: "Заметка не может быть пустой" };
  }

  if (!(await addNoteRow(user.id, contactId, body))) {
    return { ok: false, error: CONTACT_NOT_FOUND };
  }

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/");
  return { ok: true, contactId };
}

// "We talked": sets the last contact moment to now, using the database clock.
export async function markContacted(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireUser();
  const contactId = Number(formData.get("contactId"));
  if (!Number.isInteger(contactId)) {
    return { ok: false, error: CONTACT_NOT_FOUND };
  }

  if (!(await markContactedRow(user.id, contactId))) {
    return { ok: false, error: CONTACT_NOT_FOUND };
  }

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/");
  return { ok: true, contactId };
}

export async function renameGroup(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) {
    return { ok: false, error: GROUP_NOT_FOUND };
  }

  const result = await renameGroupRow(user.id, id, formData.get("name"));
  // The name shows up in the filter, the forms and every contact's labels.
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

// Removes only the group; its contacts stay. Shows the whole list afterwards.
export async function deleteGroup(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) {
    return { ok: false, error: GROUP_NOT_FOUND };
  }

  await deleteGroupRow(user.id, id);

  revalidatePath("/", "layout");
  redirect("/");
}
