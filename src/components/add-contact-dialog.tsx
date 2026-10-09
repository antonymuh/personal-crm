"use client";

import { useActionState, useEffect, useState } from "react";
import { UserPlus } from "lucide-react";

import { createContact, type ActionResult } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ContactFields } from "@/components/contact-fields";

export function AddContactDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(createContact, null);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4" />
          Добавить контакт
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый контакт</DialogTitle>
          <DialogDescription>
            Заполните данные. Обязательно только имя.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <ContactFields />
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
