// "Today" for everything that depends on the calendar day. The server runs in
// UTC, so the day is taken in Moscow time: after midnight in Moscow it is
// already the next day here too.
const moscowDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Moscow",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// "YYYY-MM-DD" for the given moment (now by default).
export function moscowToday(now: Date = new Date()): string {
  const parts = Object.fromEntries(
    moscowDate.formatToParts(now).map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
