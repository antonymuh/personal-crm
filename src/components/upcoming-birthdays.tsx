import Link from "next/link";
import { Cake } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { UpcomingBirthday } from "@/db/birthdays";
import { turningLabel, whenLabel } from "@/lib/birthdays";
import { formatDayMonth } from "@/lib/format";

// Birthdays today and in the coming week, nearest first. Shows nothing when
// there are none. Plain server markup: no state, no client code.
export function UpcomingBirthdays({ items }: { items: UpcomingBirthday[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="upcoming-birthdays" className="space-y-3">
      <h2
        id="upcoming-birthdays"
        className="flex items-center gap-2 font-display text-xl font-bold tracking-[-0.02em]"
      >
        <Cake className="h-5 w-5 shrink-0" />
        Скоро день рождения
      </h2>
      <ul className="space-y-3">
        {items.map((b) => (
          <li key={b.id}>
            <Link
              href={`/contacts/${b.id}`}
              prefetch={false}
              className="group block rounded-sketch focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card
                className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 transition-transform group-hover:-translate-y-0.5 sm:px-5 ${
                  b.daysUntil === 0
                    ? "bg-yellow shadow-pop"
                    : "shadow-pop-yellow"
                }`}
              >
                <span className="min-w-0 truncate font-display font-bold">
                  {b.name}
                </span>
                <span className="text-sm">
                  <span className="font-semibold">
                    {whenLabel(b.daysUntil)}
                  </span>
                  {" · "}
                  {formatDayMonth(b.date)}
                  {", "}
                  {turningLabel(b.daysUntil, b.turning)}
                </span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
