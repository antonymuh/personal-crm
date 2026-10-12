"use client";

import Link from "next/link";
import { Mail, Phone, StickyNote } from "lucide-react";

import { Card } from "@/components/ui/card";

export type ContactListItem = {
  id: number;
  name: string;
  howWeMet: string | null;
  phone: string | null;
  email: string | null;
  noteCount: number;
};

// Rendered as a client component on purpose: the server then sends plain row
// data instead of a serialized element tree for every card, which is what made
// the home page slow with a thousand contacts.
export function ContactList({ items }: { items: ContactListItem[] }) {
  return (
    <ul className="space-y-2">
      {items.map((c) => (
        <li key={c.id}>
          <Link href={`/contacts/${c.id}`} prefetch={false} className="block">
            <Card className="p-4 transition-colors hover:bg-accent">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.name}</div>
                  {c.howWeMet && (
                    <div className="truncate text-sm text-muted-foreground">
                      {c.howWeMet}
                    </div>
                  )}
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
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
                {c.noteCount > 0 && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                    <StickyNote className="h-3.5 w-3.5" />
                    {c.noteCount}
                  </span>
                )}
              </div>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
