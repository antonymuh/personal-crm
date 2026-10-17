import { asc, ilike, sql } from "drizzle-orm";

import { db } from "@/db";
import { contacts, notes } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { ContactList } from "@/components/contact-list";
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

  // Note counts come from the same query, so the database is hit once.
  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      howWeMet: contacts.howWeMet,
      phone: contacts.phone,
      email: contacts.email,
      noteCount: sql<number>`(select count(*)::int from ${notes} where ${notes.contactId} = ${contacts.id})`,
    })
    .from(contacts)
    .where(query ? ilike(contacts.name, `%${query}%`) : undefined)
    .orderBy(asc(contacts.name));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
            Контакты
          </h1>
          <p className="mt-1 text-muted-foreground">
            {query
              ? `Найдено: ${rows.length}`
              : `Всего контактов: ${rows.length}`}
          </p>
        </div>
        <AddContactDialog />
      </div>

      <ContactSearch initialQuery={query} />

      {rows.length === 0 ? (
        <Card className="p-10 text-center text-lg text-muted-foreground">
          {query
            ? "Никого не нашли. Попробуйте другое имя."
            : "Пока нет контактов. Добавьте первый."}
        </Card>
      ) : (
        <ContactList items={rows} />
      )}
    </div>
  );
}
