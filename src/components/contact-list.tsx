"use client";

import Link from "next/link";
import { Mail, Phone, StickyNote } from "lucide-react";

import { Card } from "@/components/ui/card";
import { DueBadge } from "@/components/due-badge";

export type ContactListItem = {
  id: number;
  name: string;
  howWeMet: string | null;
  phone: string | null;
  email: string | null;
  noteCount: number;
  isDue: boolean;
};

// Rendered as a client component on purpose: the server then sends plain row
// data instead of a serialized element tree for every card, which is what made
// the home page slow with a thousand contacts.
// Cards cycle through the landing's shapes and shadow colors.
const cardStyles = [
  "rounded-sketch shadow-pop-pink",
  "rounded-sketch-alt shadow-pop-yellow",
  "rounded-sketch shadow-pop-cyan",
  "rounded-sketch-alt shadow-pop-green",
];

export function ContactList({ items }: { items: ContactListItem[] }) {
  return (
    <ul className="space-y-4">
      {items.map((c, i) => (
        <li key={c.id}>
          <Link
            href={`/contacts/${c.id}`}
            prefetch={false}
            className="group block rounded-sketch focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card
              className={`p-4 transition-transform group-hover:-translate-y-0.5 sm:px-5 ${cardStyles[i % cardStyles.length]}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate font-display font-bold">{c.name}</div>
                  {c.howWeMet && (
                    <div className="mt-0.5 truncate text-sm text-muted-foreground">
                      {c.howWeMet}
                    </div>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {c.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {c.phone}
                      </span>
                    )}
                    {c.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" />
                        {c.email}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {c.isDue && <DueBadge />}
                  {c.noteCount > 0 && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-blob border-2 border-ink bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
                      <StickyNote className="h-3.5 w-3.5" />
                      {c.noteCount}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
