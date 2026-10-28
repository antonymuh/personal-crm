import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { RenameGroupDialog } from "@/components/rename-group-dialog";
import { DeleteGroupDialog } from "@/components/delete-group-dialog";
import { cn } from "@/lib/utils";

type Group = { id: number; name: string };

// Keeps the name search when switching groups.
function filterHref(query: string, groupId: number | null): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (groupId !== null) params.set("group", String(groupId));
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

function FilterLink({
  href,
  selected,
  children,
}: {
  href: string;
  selected: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={selected ? "page" : undefined}
      className={cn(
        buttonVariants({ variant: selected ? "default" : "outline", size: "sm" }),
        "max-w-full"
      )}
    >
      <span className="truncate">{children}</span>
    </Link>
  );
}

// "All" and every group as links; rename and delete for the chosen group.
// Hidden until the first group exists.
export function GroupFilter({
  groups,
  selected,
  query,
}: {
  groups: Group[];
  selected: Group | null;
  query: string;
}) {
  if (groups.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Фильтр по группе" className="flex flex-wrap gap-2">
        <FilterLink href={filterHref(query, null)} selected={selected === null}>
          Все
        </FilterLink>
        {groups.map((g) => (
          <FilterLink
            key={g.id}
            href={filterHref(query, g.id)}
            selected={selected?.id === g.id}
          >
            {g.name}
          </FilterLink>
        ))}
      </nav>
      {selected && (
        <div className="flex flex-wrap gap-2">
          {/* Keyed by group, so a stale error from another group never shows. */}
          <RenameGroupDialog key={`rename-${selected.id}`} group={selected} />
          <DeleteGroupDialog key={`delete-${selected.id}`} group={selected} />
        </div>
      )}
    </div>
  );
}
