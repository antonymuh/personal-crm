const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}

// Birth dates are "YYYY-MM-DD" strings. They are shown in UTC so the day never
// shifts with the time zone of the server.
const dayMonthFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

// "15 ноября"
export function formatDayMonth(date: string): string {
  return dayMonthFormatter.format(new Date(`${date}T00:00:00Z`));
}

// "15 ноября 1990" (Intl would add "г." after the year).
export function formatBirthDate(date: string): string {
  return `${formatDayMonth(date)} ${date.slice(0, 4)}`;
}
