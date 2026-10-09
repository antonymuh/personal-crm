"use client";

import { useActionState, useEffect, useRef } from "react";

import { addNote, type ActionResult } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function AddNoteForm({ contactId }: { contactId: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(addNote, null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-2">
      <input type="hidden" name="contactId" value={contactId} />
      <Textarea
        name="body"
        placeholder="О чём договорились, что обсудили…"
        required
        rows={3}
      />
      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Добавляю…" : "Добавить заметку"}
        </Button>
      </div>
    </form>
  );
}
