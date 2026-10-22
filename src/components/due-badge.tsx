import { BellRing } from "lucide-react";

// "Time to get in touch" mark, shared by the contact list and the contact page.
export function DueBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-blob border-2 border-ink bg-pink px-2.5 py-1 text-xs font-semibold text-ink">
      <BellRing className="h-3.5 w-3.5" />
      Пора связаться
    </span>
  );
}
