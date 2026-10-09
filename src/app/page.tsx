import Link from "next/link";
import { asc, ilike, sql } from "drizzle-orm";
import { Mail, Phone, StickyNote } from "lucide-react";

import { db } from "@/db";
import { contacts, notes } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { ContactSearch } from "@/components/contact-search";
import { AddContactDialog } from "@/components/add-contact-dialog";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      howWeMet: contacts.howWeMet,
      phone: contacts.phone,
      email: contacts.email,
    })
    .from(contacts)
    .where(query ? ilike(contacts.name, `%${query}%`) : undefined)
    .orderBy(asc(contacts.name));

  // Note counts per contact, merged in memory.
  const counts = await db
    .select({
      contactId: notes.contactId,
      count: sql<number>`count(*)::int`,
    })
    .from(notes)
    .groupBy(notes.contactId);
  const countMap = new Map(counts.map((c) => [c.contactId, c.count]));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Контакты</h1>
          <p className="text-sm text-muted-foreground">
            {query
              ? `Найдено: ${rows.length}`
              : `Всего контактов: ${rows.length}`}
          </p>
        </div>
        <AddContactDialog />
      </div>

      <ContactSearch initialQuery={query} />

      {rows.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          {query
            ? "Никого не нашли. Попробуйте другое имя."
            : "Пока нет контактов. Добавьте первый."}
        </Card>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => {
            const noteCount = countMap.get(c.id) ?? 0;
            return (
              <li key={c.id}>
                <Link href={`/contacts/${c.id}`} className="block">
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
                      {noteCount > 0 && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                          <StickyNote className="h-3.5 w-3.5" />
                          {noteCount}
                        </span>
                      )}
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
