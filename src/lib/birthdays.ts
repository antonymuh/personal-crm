// The one rule for birthdays, used by the contact card, the "upcoming
// birthdays" block and the form check. Dates are "YYYY-MM-DD" strings and
// "today" is always passed in, so nothing here reads the clock or the database.

export const BIRTH_DATE_INVALID = "Некорректная дата рождения";
export const BIRTH_DATE_IN_FUTURE = "Дата рождения не может быть в будущем";
export const EARLIEST_BIRTH_DATE = "1900-01-01";

export type ParsedBirthDate =
  { ok: true; date: string | null } | { ok: false; error: string };

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type DateParts = { year: number; month: number; day: number };

// Parts of a real calendar date, or null for "31 February" and the like.
function splitDate(value: string): DateParts | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const [year, month, day] = [match[1], match[2], match[3]].map(Number);
  // Build the date from the parts and compare them back.
  const built = new Date(Date.UTC(year, month - 1, day));
  if (
    built.getUTCFullYear() !== year ||
    built.getUTCMonth() !== month - 1 ||
    built.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function joinDate({ year, month, day }: DateParts): string {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

// Whole days from one date to another, by UTC midnights: no daylight saving.
function daysBetween(from: DateParts, to: DateParts): number {
  return Math.round(
    (Date.UTC(to.year, to.month - 1, to.day) -
      Date.UTC(from.year, from.month - 1, from.day)) /
      MS_PER_DAY
  );
}

// Empty means "not set". Anything else must be a real date from 1 January
// 1900 up to today (strings in this format compare in date order).
export function parseBirthDate(value: unknown, today: string): ParsedBirthDate {
  if (value === null || value === undefined) return { ok: true, date: null };
  if (typeof value !== "string")
    return { ok: false, error: BIRTH_DATE_INVALID };
  const trimmed = value.trim();
  if (trimmed === "") return { ok: true, date: null };
  if (!splitDate(trimmed) || trimmed < EARLIEST_BIRTH_DATE) {
    return { ok: false, error: BIRTH_DATE_INVALID };
  }
  if (trimmed > today) return { ok: false, error: BIRTH_DATE_IN_FUTURE };
  return { ok: true, date: trimmed };
}

function mustSplit(value: string): DateParts {
  const parts = splitDate(value);
  if (!parts) throw new Error(`Not a calendar date: ${value}`);
  return parts;
}

// Full years lived by `today`.
export function ageOn(birthDate: string, today: string): number {
  const birth = mustSplit(birthDate);
  const now = mustSplit(today);
  const passed =
    now.month > birth.month ||
    (now.month === birth.month && now.day >= birth.day);
  return now.year - birth.year - (passed ? 0 : 1);
}

// The birthday in a given year; 29 February becomes 28 February in a common year.
function birthdayIn(birth: DateParts, year: number): DateParts {
  const day =
    birth.month === 2 && birth.day === 29 && !isLeapYear(year) ? 28 : birth.day;
  return { year, month: birth.month, day };
}

export type NextBirthday = {
  // The coming birthday, "YYYY-MM-DD" (today counts).
  date: string;
  daysUntil: number;
  // The age reached on that day.
  turning: number;
};

export function nextBirthday(birthDate: string, today: string): NextBirthday {
  const birth = mustSplit(birthDate);
  const now = mustSplit(today);
  let next = birthdayIn(birth, now.year);
  let daysUntil = daysBetween(now, next);
  if (daysUntil < 0) {
    next = birthdayIn(birth, now.year + 1);
    daysUntil = daysBetween(now, next);
  }
  return { date: joinDate(next), daysUntil, turning: next.year - birth.year };
}

const pluralRules = new Intl.PluralRules("ru");

// "1 год" / "2 года" / "5 лет"; n is a whole number.
function plural(n: number, one: string, few: string, many: string): string {
  const category = pluralRules.select(n);
  return category === "one" ? one : category === "few" ? few : many;
}

export function yearsLabel(years: number): string {
  return `${years} ${plural(years, "год", "года", "лет")}`;
}

export function whenLabel(daysUntil: number): string {
  if (daysUntil === 0) return "Сегодня";
  if (daysUntil === 1) return "Завтра";
  return `Через ${daysUntil} ${plural(daysUntil, "день", "дня", "дней")}`;
}

export function turningLabel(daysUntil: number, turning: number): string {
  return `${daysUntil === 0 ? "исполняется" : "исполнится"} ${turning}`;
}
