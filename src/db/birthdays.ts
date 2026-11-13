import { and, eq, isNotNull } from "drizzle-orm";

import { db, type Executor } from "@/db";
import { contacts } from "@/db/schema";
import { nextBirthday } from "@/lib/birthdays";

// Birthdays today and in the 7 days after it: 8 dates in all.
const WINDOW_DAYS = 7;

export type UpcomingBirthday = {
  id: number;
  name: string;
  daysUntil: number;
  // The coming birthday, "YYYY-MM-DD".
  date: string;
  // The age reached on that day.
  turning: number;
};

// The "upcoming birthdays" block on the home page: the user's own contacts
// with a birth date, nearest first, one date by name. Search and group filter
// are not parameters on purpose: the block never depends on them. The window
// and the order come from nextBirthday, the same rule the card uses, so
// 29 February and the new year are written once.
export async function listUpcomingBirthdays(
  userId: string,
  today: string,
  executor: Executor = db
): Promise<UpcomingBirthday[]> {
  const rows = await executor
    .select({
      id: contacts.id,
      name: contacts.name,
      birthDate: contacts.birthDate,
    })
    .from(contacts)
    .where(and(eq(contacts.userId, userId), isNotNull(contacts.birthDate)));

  return rows
    .flatMap(({ id, name, birthDate }) => {
      if (birthDate === null) return [];
      const { date, daysUntil, turning } = nextBirthday(birthDate, today);
      return daysUntil <= WINDOW_DAYS
        ? [{ id, name, daysUntil, date, turning }]
        : [];
    })
    .sort(
      (a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name, "ru")
    );
}
