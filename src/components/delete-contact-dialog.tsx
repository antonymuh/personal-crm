"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";

import { deleteContact, type ActionResult } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DeleteContactDialog({
  contact,
}: {
  contact: { id: number; name: string };
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(deleteContact, null);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Trash2 className="h-4 w-4" />
          Удалить
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Точно удалить?</DialogTitle>
          <DialogDescription>
            Может, хоть открытку на Новый год присылать будешь? Контакт «
            {contact.name}» и все заметки о нём удалятся насовсем.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="id" value={contact.id} />
          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Оставлю, пришлю открытку
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Удаляю…" : "Удалить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
