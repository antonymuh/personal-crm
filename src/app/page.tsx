import { listContacts } from "@/db/contact-list";
import { listGroups } from "@/db/groups";
import { Card } from "@/components/ui/card";
import { ContactList } from "@/components/contact-list";
import { ChosenGroupProvider } from "@/components/chosen-group";
import { ContactSearch } from "@/components/contact-search";
import { AddContactDialog } from "@/components/add-contact-dialog";
import { GroupFilter } from "@/components/group-filter";
import { findSelectedGroup } from "@/lib/groups";

export const dynamic = "force-dynamic";

function emptyMessage(query: string, inGroup: boolean): string {
  if (query) return "Никого не нашли. Попробуйте другое имя.";
  if (inGroup) return "В этой группе пока никого нет";
  return "Пока нет контактов. Добавьте первый.";
}

function countLabel(query: string, inGroup: boolean, count: number): string {
  if (query) return `Найдено: ${count}`;
  if (inGroup) return `В группе: ${count}`;
  return `Всего контактов: ${count}`;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; group?: string | string[] }>;
}) {
  const { q, group } = await searchParams;
  const query = q?.trim() ?? "";

  // A group that no longer exists (e.g. deleted in another tab) means "all".
  const groups = await listGroups();
  const selected = findSelectedGroup(groups, group);
  const rows = await listContacts({ query, groupId: selected?.id ?? null });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
            Контакты
          </h1>
          <p className="mt-1 text-muted-foreground">
            {countLabel(query, selected !== null, rows.length)}
          </p>
        </div>
        <AddContactDialog groups={groups} />
      </div>

      <ChosenGroupProvider groupId={selected?.id ?? null}>
        <ContactSearch initialQuery={query} />

        <GroupFilter groups={groups} selected={selected} query={query} />
      </ChosenGroupProvider>

      {rows.length === 0 ? (
        <Card className="p-10 text-center text-lg text-muted-foreground">
          {emptyMessage(query, selected !== null)}
        </Card>
      ) : (
        <ContactList items={rows} />
      )}
    </div>
  );
}
