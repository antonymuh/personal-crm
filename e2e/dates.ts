import { moscowToday } from "../src/lib/today";

// The app counts "today" in Moscow, so the tests do too. Dates are
// "YYYY-MM-DD" strings; days are added by UTC midnights.
export function daysFromToday(days: number): string {
  const [year, month, day] = moscowToday().split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

// A birth date whose birthday falls `daysAhead` days from today, for a person
// who turns `turning` that day. Keep `turning` a multiple of 4 so that
// 29 February stays a real date.
export function birthDateFor(daysAhead: number, turning: number): string {
  const [year, ...rest] = daysFromToday(daysAhead).split("-");
  return [Number(year) - turning, ...rest].join("-");
}
