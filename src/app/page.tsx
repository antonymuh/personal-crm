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
        <ContactList items={rows} />
      )}
    </div>
  );
}
