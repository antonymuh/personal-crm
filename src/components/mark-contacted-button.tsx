"use client";

import { useActionState } from "react";
import { MessageCircleHeart } from "lucide-react";

import { markContacted, type ActionResult } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function MarkContactedButton({ contactId }: { contactId: number }) {
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(markContacted, null);

  return (
    <form action={formAction} className="grid gap-1">
      <input type="hidden" name="contactId" value={contactId} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        <MessageCircleHeart className="h-4 w-4" />
        {pending ? "Сохраняю…" : "Пообщались"}
      </Button>
      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
    </form>
  );
}
