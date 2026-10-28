// Rules for group names and for reading groups from forms and the address.
// Shared by server actions and pages; must not import anything server-only.

import { clean } from "@/lib/form";

export const GROUP_NAME_REQUIRED = "Укажите название группы";
export const GROUP_NAME_TAKEN = "Группа с таким названием уже есть";

// Spaces around the name are dropped; an empty name means "no name".
export const cleanGroupName = clean;

export function parseGroupName(
  value: unknown
): { ok: true; name: string } | { ok: false; error: string } {
  const name = cleanGroupName(value);
  return name ? { ok: true, name } : { ok: false, error: GROUP_NAME_REQUIRED };
}

function parseId(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// Checked group boxes arrive as repeated "groupIds" form values.
export function parseGroupIds(values: unknown[]): number[] {
  const ids = new Set<number>();
  for (const value of values) {
    const id = parseId(value);
    if (id !== null) ids.add(id);
  }
  return [...ids];
}

// "?group=<id>"; null means "all contacts".
export function parseGroupFilter(
  value: string | string[] | undefined
): number | null {
  return parseId(Array.isArray(value) ? value[0] : value);
}

// The group chosen in the address, or null ("all contacts") when there is no
// filter or the group no longer exists.
export function findSelectedGroup<T extends { id: number }>(
  groups: T[],
  value: string | string[] | undefined
): T | null {
  const id = parseGroupFilter(value);
  return groups.find((g) => g.id === id) ?? null;
}
