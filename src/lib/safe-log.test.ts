import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { contacts } from "@/db/schema";
import { installSafeConsole, redactError } from "@/lib/safe-log";

import { resetDatabase } from "../../test/db";

const NAME = "Анна Секретова";
const PHONE = "+79990001122";
const EMAIL = "secret@example.com";

// A real failed query: the contact points at a user that does not exist, so
// Postgres rejects it and Drizzle puts the SQL and all values into the error.
async function failedInsert(): Promise<unknown> {
  try {
    await db.insert(contacts).values({
      userId: "no-such-user",
      name: NAME,
      phone: PHONE,
      email: EMAIL,
    });
  } catch (err) {
    return err;
  }
  throw new Error("expected the insert to fail");
}

function expectNoContactData(text: string) {
  expect(text).not.toContain(NAME);
  expect(text).not.toContain(PHONE);
  expect(text).not.toContain(EMAIL);
}

function asText(value: unknown): string {
  if (value instanceof Error) {
    return [value.message, value.stack, JSON.stringify(value)].join("\n");
  }
  return String(value);
}

beforeEach(async () => {
  await resetDatabase();
});

describe("redactError", () => {
  it("keeps the database error but drops the query and its values", async () => {
    const err = await failedInsert();
    // The raw error does leak the values; that is what we guard against.
    expect(asText(err)).toContain(EMAIL);

    const safe = redactError(err);

    expect(safe).toBeInstanceOf(Error);
    expectNoContactData(asText(safe));
    expect(asText(safe)).toContain("Database query failed");
    expect(asText(safe)).toContain("23503");
    expect(asText(safe)).toContain("contacts");
  });

  it("cleans a database error wrapped in another error", async () => {
    const wrapped = new Error("Saving failed", { cause: await failedInsert() });

    const safe = redactError(wrapped);

    expectNoContactData(asText(safe));
    expect(asText(safe)).toContain("23503");
  });

  it("leaves other errors and values as they are", () => {
    const plain = new Error("Mail server is down");

    expect(redactError(plain)).toBe(plain);
    expect(redactError("just text")).toBe("just text");
  });
});

describe("installSafeConsole", () => {
  it("writes database errors to the log without the contact's data", async () => {
    // The original writers; installSafeConsole puts its own in front of them.
    const error = vi.fn();
    const warn = vi.fn();
    const target = { error, warn };
    installSafeConsole(target);
    const err = await failedInsert();

    target.error("Save failed", err);
    target.warn(err);

    const logged = [...error.mock.calls, ...warn.mock.calls]
      .flat()
      .map(asText)
      .join("\n");
    expectNoContactData(logged);
    expect(logged).toContain("Save failed");
    expect(logged).toContain("23503");
  });
});
