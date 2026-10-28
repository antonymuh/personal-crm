"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { useChosenGroup } from "@/components/chosen-group";
import { cn } from "@/lib/utils";

export function FilterLink({
  href,
  groupId,
  selected,
  children,
}: {
  href: string;
  // The group this link switches to; null is "all".
  groupId: number | null;
  selected: boolean;
  children: React.ReactNode;
}) {
  const chosenGroup = useChosenGroup();

  return (
    <Link
      href={href}
      onClick={() => chosenGroup.choose(groupId)}
      aria-current={selected ? "page" : undefined}
      className={cn(
        buttonVariants({
          variant: selected ? "default" : "outline",
          size: "sm",
        }),
        "max-w-full"
      )}
    >
      <span className="truncate">{children}</span>
    </Link>
  );
}
