"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";

import { updateContact, type ActionResult } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ContactFields, type GroupOption } from "@/components/contact-fields";

type Contact = {
  id: number;
  name: string;
  howWeMet: string | null;
  phone: string | null;
  email: string | null;
  contactFrequency: string | null;
};

export function EditContactDialog({
  contact,
  groups,
  groupIds,
}: {
  contact: Contact;
  groups: GroupOption[];
  groupIds: number[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(async (prev, formData) => {
    const result = await updateContact(prev, formData);
    // Close the dialog right after a successful save.
    if (result.ok) setOpen(false);
    return result;
  }, null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4" />
          Изменить
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Изменить контакт</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="id" value={contact.id} />
          <ContactFields defaults={{ ...contact, groupIds }} groups={groups} />
          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Сохраняю…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
