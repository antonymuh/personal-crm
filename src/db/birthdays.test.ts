import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { contacts, type User } from "@/db/schema";
import { listUpcomingBirthdays } from "@/db/birthdays";
import { addContact, addUser, resetDatabase } from "../../test/db";

let me: User;
let other: User;

beforeEach(async () => {
  await resetDatabase();
  me = await addUser("anna@example.com");
  other = await addUser("boris@example.com");
});

async function addBorn(userId: string, name: string, birthDate: string) {
  const contact = await addContact(userId, name);
  await db
    .update(contacts)
    .set({ birthDate })
    .where(eq(contacts.id, contact.id));
  return contact;
}

const names = (rows: { name: string }[]) => rows.map((r) => r.name);

describe("listUpcomingBirthdays", () => {
  it("puts the nearest birthdays first", async () => {
    await addBorn(me.id, "Вера", "1992-11-20");
    await addBorn(me.id, "Борис", "2000-11-14");
    await addBorn(me.id, "Анна", "1990-11-13");

    const rows = await listUpcomingBirthdays(me.id, "2026-11-13");

    expect(names(rows)).toEqual(["Анна", "Борис", "Вера"]);
  });

  it("includes the 7th day and leaves out the 8th day and yesterday", async () => {
    await addBorn(me.id, "Гена", "1990-11-20");
    await addBorn(me.id, "Дина", "1990-11-21");
    await addBorn(me.id, "Егор", "1990-11-12");

    const rows = await listUpcomingBirthdays(me.id, "2026-11-13");

    expect(names(rows)).toEqual(["Гена"]);
  });

  it("orders one date by name", async () => {
    await addBorn(me.id, "Яна", "1990-11-16");
    await addBorn(me.id, "Аня", "1995-11-16");

    const rows = await listUpcomingBirthdays(me.id, "2026-11-13");

    expect(names(rows)).toEqual(["Аня", "Яна"]);
  });

  it("leaves out contacts without a birth date", async () => {
    await addContact(me.id, "Глеб");
    await addBorn(me.id, "Анна", "1990-11-13");

    const rows = await listUpcomingBirthdays(me.id, "2026-11-13");

    expect(names(rows)).toEqual(["Анна"]);
  });

  it("reaches over the new year", async () => {
    await addBorn(me.id, "Илья", "1995-01-02");

    const rows = await listUpcomingBirthdays(me.id, "2026-12-28");

    expect(rows).toEqual([
      {
        id: expect.any(Number),
        name: "Илья",
        daysUntil: 5,
        date: "2027-01-02",
        turning: 32,
      },
    ]);
  });

  it("returns what the block shows for each contact", async () => {
    const anna = await addBorn(me.id, "Анна", "1990-11-13");
    const boris = await addBorn(me.id, "Борис", "2000-11-14");

    const rows = await listUpcomingBirthdays(me.id, "2026-11-13");

    expect(rows).toEqual([
      {
        id: anna.id,
        name: "Анна",
        daysUntil: 0,
        date: "2026-11-13",
        turning: 36,
      },
      {
        id: boris.id,
        name: "Борис",
        daysUntil: 1,
        date: "2026-11-14",
        turning: 26,
      },
    ]);
  });

  it("does not show another user's contact", async () => {
    await addBorn(other.id, "Чужая", "1990-11-14");
    await addBorn(me.id, "Моя", "1990-11-15");

    const rows = await listUpcomingBirthdays(me.id, "2026-11-13");

    expect(names(rows)).toEqual(["Моя"]);
  });

  it("is empty when nobody has a birthday soon", async () => {
    await addBorn(me.id, "Анна", "1990-03-01");

    expect(await listUpcomingBirthdays(me.id, "2026-11-13")).toEqual([]);
  });
});
