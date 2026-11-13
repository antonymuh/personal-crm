import { describe, expect, it } from "vitest";

import { moscowToday } from "@/lib/today";

describe("moscowToday", () => {
  it("is already the next day after midnight in Moscow", () => {
    expect(moscowToday(new Date("2026-11-13T22:30:00Z"))).toBe("2026-11-14");
  });

  it("is still the same day one second before midnight in Moscow", () => {
    expect(moscowToday(new Date("2026-11-13T20:59:59Z"))).toBe("2026-11-13");
  });

  it("switches exactly at midnight in Moscow", () => {
    expect(moscowToday(new Date("2026-11-13T21:00:00Z"))).toBe("2026-11-14");
  });

  it("crosses the new year and keeps leading zeros", () => {
    expect(moscowToday(new Date("2026-12-31T21:00:00Z"))).toBe("2027-01-01");
    expect(moscowToday(new Date("2026-03-04T10:00:00Z"))).toBe("2026-03-04");
  });

  it("returns a YYYY-MM-DD string for the current moment", () => {
    expect(moscowToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
