import { describe, expect, it } from "vitest";

import { formatBirthDate, formatDayMonth } from "@/lib/format";

describe("formatBirthDate", () => {
  it("writes day, month and year without «г.»", () => {
    expect(formatBirthDate("1990-11-15")).toBe("15 ноября 1990");
    expect(formatBirthDate("1985-03-03")).toBe("3 марта 1985");
  });

  it("does not shift the day whatever the time zone of the process", () => {
    expect(formatBirthDate("2000-01-01")).toBe("1 января 2000");
    expect(formatBirthDate("2000-12-31")).toBe("31 декабря 2000");
  });
});

describe("formatDayMonth", () => {
  it("writes day and month only", () => {
    expect(formatDayMonth("2026-11-15")).toBe("15 ноября");
    expect(formatDayMonth("2028-02-29")).toBe("29 февраля");
  });
});
