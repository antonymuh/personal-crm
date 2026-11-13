import type { Page } from "@playwright/test";

import { birthDateFor, daysFromToday } from "./dates";
import { withE2eDatabase } from "./database";
import { expect, OWNER, signIn, test } from "./fixtures";
import { countAllEmails } from "./mailpit";

// Scenarios from openspec/changes/birthdays/specs/contact-birthdays/spec.md.
// Exact edges (the 8th day, 29 February, the new year) are checked by Vitest
// with a chosen "today"; here the browser sees the real date, so birthdays are
// never put on the edge of the window.

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

async function addContact(
  page: Page,
  name: string,
  { birthDate }: { birthDate?: string } = {}
) {
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  const dialog = page.getByRole("dialog", { name: "Новый контакт" });
  await dialog.getByLabel("Имя").fill(name);
  if (birthDate) await dialog.getByLabel("Дата рождения").fill(birthDate);
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(dialog).toBeHidden();
}

async function openCard(page: Page, name: string) {
  // A fixed birth date can land in the coming week, and then the name is also
  // a link in the block above the list; the list is the last one.
  await page
    .getByRole("link", { name: new RegExp(name) })
    .last()
    .click();
  await expect(page).toHaveURL(/\/contacts\/\d+$/);
}

async function editBirthDate(page: Page, birthDate: string) {
  await page.getByRole("button", { name: "Изменить" }).click();
  const dialog = page.getByRole("dialog", { name: "Изменить контакт" });
  await dialog.getByLabel("Дата рождения").fill(birthDate);
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(dialog).toBeHidden();
}

// Other contacts are set up straight in the database: the forms are covered by
// the tests above, and here only the block on the home page matters.
async function insertContact(
  name: string,
  birthDate: string | null,
  { group, email = OWNER }: { group?: string; email?: string } = {}
) {
  await withE2eDatabase(async (sql) => {
    const [contact] = await sql<{ id: number }[]>`
      insert into contacts (user_id, name, birth_date)
      select id, ${name}, ${birthDate} from "user" where email = ${email}
      returning id`;
    if (!group) return;
    const [row] = await sql<{ id: number }[]>`
      insert into groups (user_id, name)
      select id, ${group} from "user" where email = ${email}
      returning id`;
    await sql`insert into contact_groups (contact_id, group_id)
      values (${contact.id}, ${row.id})`;
  });
}

const block = (page: Page) =>
  page.getByRole("region", { name: "Скоро день рождения" });

const birthdayLine = (page: Page) => page.getByText(/^День рождения:/);

test("a birth date entered in the form shows up in the card with the age", async ({
  page,
}) => {
  await page.goto("/");
  await addContact(page, "Анна", { birthDate: "1990-11-15" });
  await openCard(page, "Анна");
  await expect(birthdayLine(page)).toHaveText(
    /^День рождения: 15 ноября 1990 \(\d+ (год|года|лет)\)$/
  );
});

test("the age in the card is the number of full years today", async ({
  page,
}) => {
  // Turned 32 yesterday: not 31, and not 33 yet.
  await page.goto("/");
  await addContact(page, "Борис", { birthDate: birthDateFor(-1, 32) });
  await openCard(page, "Борис");
  await expect(birthdayLine(page)).toContainText("(32 года)");
});

test("the birth date can be changed and erased", async ({ page }) => {
  await page.goto("/");
  await addContact(page, "Вера", { birthDate: "1990-11-15" });
  await openCard(page, "Вера");

  await editBirthDate(page, "1985-03-03");
  await expect(birthdayLine(page)).toContainText("3 марта 1985");

  await editBirthDate(page, "");
  await expect(birthdayLine(page)).toBeHidden();
  await expect(page.getByText("Контактных данных пока нет")).toBeVisible();

  // Reopening the form shows an empty field, not the old date.
  await page.getByRole("button", { name: "Изменить" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Изменить контакт" })
      .getByLabel("Дата рождения")
  ).toHaveValue("");
});

test("the edit form starts with the date the contact has", async ({ page }) => {
  await page.goto("/");
  await addContact(page, "Глеб", { birthDate: "1990-11-15" });
  await openCard(page, "Глеб");
  await page.getByRole("button", { name: "Изменить" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Изменить контакт" })
      .getByLabel("Дата рождения")
  ).toHaveValue("1990-11-15");
});

test("a card without a birth date has no «День рождения» line", async ({
  page,
}) => {
  await page.goto("/");
  await addContact(page, "Дина");
  await openCard(page, "Дина");
  await expect(birthdayLine(page)).toBeHidden();
});

test("a birth date in the future is refused with a message in the form", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  const dialog = page.getByRole("dialog", { name: "Новый контакт" });
  await dialog.getByLabel("Имя").fill("Егор");
  const field = dialog.getByLabel("Дата рождения");
  // The browser calendar stops at today too; the server must refuse on its own.
  await field.evaluate((input) => input.removeAttribute("max"));
  await field.fill(daysFromToday(1));
  await dialog.getByRole("button", { name: "Сохранить" }).click();

  await expect(
    dialog.getByText("Дата рождения не может быть в будущем")
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Всего контактов: 0")).toBeVisible();
});

test("the block lists tomorrow and in 3 days, nearest first, with what they turn", async ({
  page,
}) => {
  await insertContact("Вера", birthDateFor(3, 40));
  await insertContact("Борис", birthDateFor(1, 28));
  await insertContact("Глеб", null);
  await page.goto("/");

  const items = block(page).getByRole("link");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("Борис");
  await expect(items.nth(0)).toContainText("Завтра");
  await expect(items.nth(0)).toContainText("исполнится 28");
  await expect(items.nth(1)).toContainText("Вера");
  await expect(items.nth(1)).toContainText("Через 3 дня");
  await expect(items.nth(1)).toContainText("исполнится 40");
});

test("a contact in the block opens its card", async ({ page }) => {
  await insertContact("Борис", birthDateFor(1, 28));
  await page.goto("/");

  await block(page).getByRole("link", { name: /Борис/ }).click();

  await expect(page).toHaveURL(/\/contacts\/\d+$/);
  await expect(page.getByText("Борис", { exact: true })).toBeVisible();
  await expect(page.getByText("Ко всем контактам")).toBeVisible();
});

test("the search and the group filter do not change the block", async ({
  page,
}) => {
  await insertContact("Анна", birthDateFor(1, 28), { group: "Семья" });
  await insertContact("Борис", null, { group: "Теннис" });
  await page.goto("/");
  await expect(block(page).getByRole("link", { name: /Анна/ })).toBeVisible();

  await page.getByLabel("Поиск по имени").fill("Борис");
  await expect(page.getByText("Найдено: 1")).toBeVisible();
  await expect(block(page).getByRole("link", { name: /Анна/ })).toBeVisible();

  await page.getByLabel("Поиск по имени").fill("");
  await page
    .getByRole("navigation", { name: "Фильтр по группе" })
    .getByRole("link", { name: "Теннис" })
    .click();
  await expect(page.getByText("В группе: 1")).toBeVisible();
  await expect(block(page).getByRole("link", { name: /Анна/ })).toBeVisible();
});

test("there is no block when nobody has a birthday in the coming week", async ({
  page,
}) => {
  await insertContact("Анна", birthDateFor(10, 28));
  await insertContact("Борис", null);
  await page.goto("/");

  await expect(page.getByText("Всего контактов: 2")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Скоро день рождения" })
  ).toBeHidden();
});

test("a birthday sends no emails: the only email is the sign-in one", async ({
  page,
}) => {
  await insertContact("Анна", birthDateFor(0, 36));
  await page.goto("/");
  const anna = block(page).getByRole("link", { name: /Анна/ });
  await expect(anna).toContainText("Сегодня");
  await expect(anna).toContainText("исполняется 36");

  expect(await countAllEmails()).toBe(1);
});
