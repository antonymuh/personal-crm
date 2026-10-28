import { Tag } from "lucide-react";

import { cn } from "@/lib/utils";

// Labels of a contact's groups, shared by the contact list and the contact page.
export function GroupBadges({
  names,
  className,
}: {
  names: string[];
  className?: string;
}) {
  if (names.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Группы">
      {names.map((name) => (
        <li
          key={name}
          className="inline-flex max-w-full items-center gap-1 rounded-blob border-2 border-ink bg-cyan px-2.5 py-1 text-xs font-semibold text-ink"
        >
          <Tag className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{name}</span>
        </li>
      ))}
    </ul>
  );
}
