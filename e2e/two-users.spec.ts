import type { Page } from "@playwright/test";

import { expect, signIn, test } from "./fixtures";

// The success criterion from specs/02-пользователи-вход.md and the scenarios
// from openspec/changes/login/specs/data-ownership/spec.md: two people, A and B.

async function addContact(
  page: Page,
  name: string,
  { newGroup }: { newGroup?: string } = {}
) {
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  const dialog = page.getByRole("dialog", { name: "Новый контакт" });
  await dialog.getByLabel("Имя").fill(name);
  if (newGroup) await dialog.getByLabel("Новая группа").fill(newGroup);
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(dialog).toBeHidden();
}

const filter = (page: Page) =>
  page.getByRole("navigation", { name: "Фильтр по группе" });

test("B sees none of A's contacts: not in the list, the search or by link", async ({
  page: a,
  browser,
}) => {
  await signIn(a, "a@example.com");
  await addContact(a, "Иван Петров", { newGroup: "Теннис" });
  await a.getByRole("link", { name: /Иван Петров/ }).click();
  await expect(a).toHaveURL(/\/contacts\/\d+$/);
  const cardUrl = a.url();

  const context = await browser.newContext();
  try {
    const b = await context.newPage();
    await signIn(b, "b@example.com");

    await expect(b.getByText("Всего контактов: 0")).toBeVisible();
    await expect(b.getByText("Иван Петров")).toBeHidden();
    await expect(filter(b)).toBeHidden();

    await b.getByLabel("Поиск по имени").fill("Иван");
    await expect(b.getByText("Найдено: 0")).toBeVisible();

    await b.goto(cardUrl);
    await expect(
      b.getByRole("heading", { name: "Контакт не найден" })
    ).toBeVisible();
    await expect(b.getByText("Иван Петров")).toBeHidden();
  } finally {
    await context.close();
  }

  // A still has everything.
  await a.goto("/");
  await expect(a.getByText("Всего контактов: 1")).toBeVisible();
});

test("groups with the same name stay separate; A's group in B's address means «Все»", async ({
  page: a,
  browser,
}) => {
  await signIn(a, "a@example.com");
  await addContact(a, "Иван", { newGroup: "Теннис" });
  await filter(a).getByRole("link", { name: "Теннис" }).click();
  await expect(a).toHaveURL(/group=\d+/);
  const groupUrl = new URL(a.url());

  const context = await browser.newContext();
  try {
    const b = await context.newPage();
    await signIn(b, "b@example.com");
    await addContact(b, "Дина", { newGroup: "теннис" });

    // B's own group with the same name.
    await expect(filter(b).getByRole("link")).toHaveText(["Все", "теннис"]);

    // A's group in the address: B's whole list, «Все» chosen.
    await b.goto(groupUrl.pathname + groupUrl.search);
    await expect(filter(b).getByRole("link", { name: "Все" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(b.getByText("Всего контактов: 1")).toBeVisible();
    await expect(b.getByText("Дина")).toBeVisible();
  } finally {
    await context.close();
  }

  // A's group did not change.
  await a.goto("/");
  await expect(filter(a).getByRole("link")).toHaveText(["Все", "Теннис"]);
  await expect(a.getByText("Дина")).toBeHidden();
});
