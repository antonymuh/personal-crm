import { describe, expect, it } from "vitest";

import {
  ageOn,
  nextBirthday,
  parseBirthDate,
  turningLabel,
  whenLabel,
  yearsLabel,
} from "@/lib/birthdays";

const TODAY = "2026-11-13";

describe("parseBirthDate", () => {
  it.each([[""], ["   "], [null], [undefined]])(
    "treats %j as not set",
    (value) => {
      expect(parseBirthDate(value, TODAY)).toEqual({ ok: true, date: null });
    }
  );

  it.each([["1990-11-15"], ["2026-11-13"], ["1900-01-01"], ["2000-02-29"]])(
    "accepts %s",
    (value) => {
      expect(parseBirthDate(value, TODAY)).toEqual({ ok: true, date: value });
    }
  );

  it("trims spaces around the date", () => {
    expect(parseBirthDate(" 1990-11-15 ", TODAY)).toEqual({
      ok: true,
      date: "1990-11-15",
    });
  });

  it("rejects a date in the future", () => {
    expect(parseBirthDate("2026-11-14", TODAY)).toEqual({
      ok: false,
      error: "Дата рождения не может быть в будущем",
    });
  });

  it.each([
    ["2026-02-31"],
    ["2027-02-29"],
    ["2026-13-01"],
    ["2026-00-10"],
    ["abc"],
    ["15.11.1990"],
    ["1990-1-5"],
  ])("rejects %s as not a date", (value) => {
    expect(parseBirthDate(value, TODAY)).toEqual({
      ok: false,
      error: "Некорректная дата рождения",
    });
  });

  it("rejects a date before 1900", () => {
    expect(parseBirthDate("1899-12-31", TODAY)).toEqual({
      ok: false,
      error: "Некорректная дата рождения",
    });
  });

  it("rejects a value that is not text", () => {
    expect(parseBirthDate(new File([], "x"), TODAY)).toEqual({
      ok: false,
      error: "Некорректная дата рождения",
    });
  });
});

describe("ageOn", () => {
  it("counts full years before the birthday this year", () => {
    expect(ageOn("1990-11-15", "2026-11-13")).toBe(35);
  });

  it("adds a year on the birthday itself", () => {
    expect(ageOn("1990-11-15", "2026-11-15")).toBe(36);
  });

  it("counts a 29 February birth on 28 February of a common year as not yet", () => {
    expect(ageOn("2000-02-29", "2027-02-28")).toBe(26);
    expect(ageOn("2000-02-29", "2027-03-01")).toBe(27);
  });
});

describe("yearsLabel", () => {
  it.each([
    [35, "35 лет"],
    [36, "36 лет"],
    [21, "21 год"],
    [22, "22 года"],
    [25, "25 лет"],
    [11, "11 лет"],
    [101, "101 год"],
    [0, "0 лет"],
  ])("%i → %s", (n, label) => {
    expect(yearsLabel(n)).toBe(label);
  });
});

describe("nextBirthday", () => {
  it("is today when the birthday is today", () => {
    expect(nextBirthday("1990-11-13", TODAY)).toEqual({
      date: "2026-11-13",
      daysUntil: 0,
      turning: 36,
    });
  });

  it("is tomorrow", () => {
    expect(nextBirthday("2000-11-14", TODAY)).toEqual({
      date: "2026-11-14",
      daysUntil: 1,
      turning: 26,
    });
  });

  it("counts days to a birthday later this year", () => {
    expect(nextBirthday("1990-11-20", TODAY).daysUntil).toBe(7);
    expect(nextBirthday("1990-11-21", TODAY).daysUntil).toBe(8);
  });

  it("moves a birthday that has passed to next year", () => {
    expect(nextBirthday("1990-11-12", TODAY)).toEqual({
      date: "2027-11-12",
      daysUntil: 364,
      turning: 37,
    });
  });

  it("crosses the new year", () => {
    expect(nextBirthday("1995-01-02", "2026-12-28")).toEqual({
      date: "2027-01-02",
      daysUntil: 5,
      turning: 32,
    });
  });

  it("moves 29 February to 28 February in a common year", () => {
    expect(nextBirthday("2000-02-29", "2027-02-25")).toEqual({
      date: "2027-02-28",
      daysUntil: 3,
      turning: 27,
    });
  });

  it("keeps 29 February in a leap year", () => {
    expect(nextBirthday("2000-02-29", "2028-02-25")).toEqual({
      date: "2028-02-29",
      daysUntil: 4,
      turning: 28,
    });
  });

  it("looks at the next leap year when 29 February has passed", () => {
    expect(nextBirthday("2000-02-29", "2027-03-01")).toEqual({
      date: "2028-02-29",
      daysUntil: 365,
      turning: 28,
    });
  });
});

describe("whenLabel", () => {
  it.each([
    [0, "Сегодня"],
    [1, "Завтра"],
    [2, "Через 2 дня"],
    [5, "Через 5 дней"],
    [7, "Через 7 дней"],
    [21, "Через 21 день"],
  ])("%i → %s", (days, label) => {
    expect(whenLabel(days)).toBe(label);
  });
});

describe("turningLabel", () => {
  it("says «исполняется» on the birthday itself", () => {
    expect(turningLabel(0, 36)).toBe("исполняется 36");
  });

  it("says «исполнится» on other days", () => {
    expect(turningLabel(1, 26)).toBe("исполнится 26");
    expect(turningLabel(7, 40)).toBe("исполнится 40");
  });
});
