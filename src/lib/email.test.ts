import { describe, expect, it } from "vitest";

import { INVALID_EMAIL, parseEmail } from "@/lib/email";

describe("parseEmail", () => {
  it("accepts a normal address", () => {
    expect(parseEmail("anna@example.com")).toEqual({
      ok: true,
      email: "anna@example.com",
    });
  });

  it("trims spaces and lowercases the address", () => {
    expect(parseEmail("  Anna@Example.COM  ")).toEqual({
      ok: true,
      email: "anna@example.com",
    });
  });

  it.each([
    ["anna@"],
    [""],
    ["   "],
    ["anna"],
    ["@example.com"],
    ["a b@c.d"],
    ["anna@example"],
    ["anna@@example.com"],
  ])("rejects %j", (raw) => {
    expect(parseEmail(raw)).toEqual({ ok: false, error: INVALID_EMAIL });
  });

  it("rejects a missing value", () => {
    expect(parseEmail(null)).toEqual({ ok: false, error: INVALID_EMAIL });
    expect(parseEmail(42)).toEqual({ ok: false, error: INVALID_EMAIL });
  });

  it("says what to fix in the user's words", () => {
    expect(INVALID_EMAIL).toBe("Проверь адрес почты");
  });
});
