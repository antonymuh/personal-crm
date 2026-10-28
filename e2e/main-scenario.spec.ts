import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

async function addContact(page: Page, name: string, howWeMet?: string) {
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  const dialog = page.getByRole("dialog", { name: "Новый контакт" });
  await dialog.getByLabel("Имя").fill(name);
  if (howWeMet) await dialog.getByLabel("Откуда знакомы").fill(howWeMet);
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(dialog).toBeHidden();
}

// Success criteria from specs/01-продуктовая-идея.md.
test("list, add, find, note — and the same data in another browser", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Пока нет контактов. Добавьте первый.")
  ).toBeVisible();
  await expect(page.getByText("Всего контактов: 0")).toBeVisible();

  await addContact(page, "Анна Смирнова", "Конференция, 2024");
  await addContact(page, "Борис Петров");

  const list = page.getByRole("list").first();
  await expect(page.getByText("Всего контактов: 2")).toBeVisible();
  await expect(list.getByText("Анна Смирнова")).toBeVisible();
  await expect(list.getByText("Борис Петров")).toBeVisible();

  await page.getByLabel("Поиск по имени").fill("Анна");
  await expect(page).toHaveURL(/q=%D0%90%D0%BD%D0%BD%D0%B0/);
  await expect(page.getByText("Найдено: 1")).toBeVisible();
  await expect(page.getByText("Борис Петров")).toBeHidden();

  await page.getByRole("link", { name: /Анна Смирнова/ }).click();
  await expect(page).toHaveURL(/\/contacts\/\d+$/);
  await expect(page.getByText("Анна Смирнова", { exact: true })).toBeVisible();
  await expect(page.getByText("Конференция, 2024")).toBeVisible();

  const note = "Договорились созвониться в пятницу";
  await page.getByPlaceholder("О чём договорились, что обсудили…").fill(note);
  await page.getByRole("button", { name: "Добавить заметку" }).click();
  await expect(page.getByText(note)).toBeVisible();

  // Saved on the server: still there after a reload.
  const cardUrl = page.url();
  await page.reload();
  await expect(page.getByText(note)).toBeVisible();

  // Another browser has no shared state with this one, only the server.
  const other = await browser.newContext();
  try {
    const otherPage = await other.newPage();
    await otherPage.goto("/");
    await expect(otherPage.getByText("Всего контактов: 2")).toBeVisible();
    await expect(otherPage.getByText("Анна Смирнова")).toBeVisible();
    await expect(otherPage.getByText("Борис Петров")).toBeVisible();
    await otherPage.goto(cardUrl);
    await expect(otherPage.getByText(note)).toBeVisible();
  } finally {
    await other.close();
  }
});

test("a contact without a name is not saved", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  const dialog = page.getByRole("dialog", { name: "Новый контакт" });
  await dialog.getByLabel("Имя").fill("   ");
  await dialog.getByRole("button", { name: "Сохранить" }).click();

  await expect(dialog.getByText("Укажите имя контакта")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Всего контактов: 0")).toBeVisible();
});
