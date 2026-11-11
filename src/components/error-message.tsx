import Link from "next/link";

import { Button } from "@/components/ui/button";

// Shown by both error pages. The technical error is never shown to the person.
export function ErrorMessage({ retry }: { retry: () => void }) {
  return (
    <div className="space-y-4 py-10 text-center">
      <h1 className="font-display text-2xl font-bold">Что-то пошло не так</h1>
      <p className="text-muted-foreground">
        Не получилось выполнить действие. Попробуйте ещё раз, а если не поможет
        — зайдите чуть позже.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={() => retry()}>
          Попробовать ещё раз
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Ко всем контактам</Link>
        </Button>
      </div>
    </div>
  );
}
