import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// Scenarios from openspec/specs/contact-groups/spec.md.

async function addContact(
  page: Page,
  name: string,
  { groups = [], newGroup }: { groups?: string[]; newGroup?: string } = {}
) {
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  const dialog = page.getByRole("dialog", { name: "Новый контакт" });
  await dialog.getByLabel("Имя").fill(name);
  for (const group of groups) {
    await dialog.getByRole("checkbox", { name: group }).check();
  }
  if (newGroup) await dialog.getByLabel("Новая группа").fill(newGroup);
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(dialog).toBeHidden();
}

const filter = (page: Page) =>
  page.getByRole("navigation", { name: "Фильтр по группе" });

const contactRow = (page: Page, name: string) =>
  page.getByRole("link", { name: new RegExp(name) });

const badges = (page: Page, name: string) =>
  contactRow(page, name).getByRole("list", { name: "Группы" });

// Анна (Семья), Борис (Теннис), Вера (Семья, Теннис).
async function addFamilyAndTennis(page: Page) {
  await page.goto("/");
  await addContact(page, "Анна", { newGroup: "Семья" });
  await addContact(page, "Борис", { newGroup: "Теннис" });
  await addContact(page, "Вера", { groups: ["Семья", "Теннис"] });
}

test("groups created from the contact form show up as filter and badges", async ({
  page,
}) => {
  await page.goto("/");
  await expect(filter(page)).toBeHidden();

  await addContact(page, "Анна", { newGroup: "  Семья  " });
  await expect(filter(page).getByRole("link")).toHaveText(["Все", "Семья"]);
  await expect(badges(page, "Анна")).toHaveText("Семья");

  // Same name in another case goes into the existing group.
  await addContact(page, "Борис", { groups: ["Семья"], newGroup: "теннис" });
  await addContact(page, "Вера", { newGroup: "Теннис" });
  await expect(filter(page).getByRole("link")).toHaveText([
    "Все",
    "Семья",
    "теннис",
  ]);
  await expect(badges(page, "Борис").getByRole("listitem")).toHaveText([
    "Семья",
    "теннис",
  ]);
  await expect(badges(page, "Вера")).toHaveText("теннис");

  // The contact card shows the same badges.
  await contactRow(page, "Борис").click();
  await expect(page).toHaveURL(/\/contacts\/\d+$/);
  await expect(page.getByText("Борис", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Группы" }).getByRole("listitem")
  ).toHaveText(["Семья", "теннис"]);
});

test("edit form: checkboxes show current groups, unchecking removes", async ({
  page,
}) => {
  await addFamilyAndTennis(page);

  await contactRow(page, "Вера").click();
  await page.getByRole("button", { name: "Изменить" }).click();
  const dialog = page.getByRole("dialog", { name: "Изменить контакт" });
  await expect(dialog.getByRole("checkbox", { name: "Семья" })).toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: "Теннис" })).toBeChecked();

  await dialog.getByRole("checkbox", { name: "Теннис" }).uncheck();
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("list", { name: "Группы" })).toHaveText("Семья");

  // The group itself stays.
  await page.getByRole("link", { name: "Ко всем контактам" }).click();
  await expect(
    filter(page).getByRole("link", { name: "Теннис" })
  ).toBeVisible();
});

test("filter by group, combined with search and kept in the address", async ({
  page,
  browser,
}) => {
  await addFamilyAndTennis(page);

  await filter(page).getByRole("link", { name: "Теннис" }).click();
  await expect(page).toHaveURL(/group=\d+/);
  await expect(page.getByText("В группе: 2")).toBeVisible();
  await expect(contactRow(page, "Борис")).toBeVisible();
  await expect(contactRow(page, "Вера")).toBeVisible();
  await expect(contactRow(page, "Анна")).toBeHidden();

  await filter(page).getByRole("link", { name: "Семья" }).click();
  await page.getByLabel("Поиск по имени").fill("Ве");
  await expect(page.getByText("Найдено: 1")).toBeVisible();
  await expect(page).toHaveURL(/group=\d+/);
  await expect(contactRow(page, "Вера")).toBeVisible();
  await expect(contactRow(page, "Анна")).toBeHidden();

  // The same address in another browser shows the same filter.
  const filteredUrl = page.url();
  const other = await browser.newContext();
  try {
    const otherPage = await other.newPage();
    await otherPage.goto(filteredUrl);
    await expect(
      filter(otherPage).getByRole("link", { name: "Семья" })
    ).toHaveAttribute("aria-current", "page");
    await expect(otherPage.getByText("Найдено: 1")).toBeVisible();
  } finally {
    await other.close();
  }

  await page.getByLabel("Поиск по имени").fill("");
  // The search updates the address after a short pause.
  await expect(page).not.toHaveURL(/q=/);
  await filter(page).getByRole("link", { name: "Все" }).click();
  await expect(page.getByText("Всего контактов: 3")).toBeVisible();
});

test("an empty group shows a message", async ({ page }) => {
  await page.goto("/");
  await addContact(page, "Анна", { newGroup: "Аналитики" });

  // Deleting the only contact keeps the group.
  await contactRow(page, "Анна").click();
  await page.getByRole("button", { name: "Удалить" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Удалить" })
    .click();
  await expect(
    page.getByText("Пока нет контактов. Добавьте первый.")
  ).toBeVisible();

  await filter(page).getByRole("link", { name: "Аналитики" }).click();
  await expect(page.getByText("В этой группе пока никого нет")).toBeVisible();
});

test("rename a group, and a taken name is refused", async ({ page }) => {
  await addFamilyAndTennis(page);
  await filter(page).getByRole("link", { name: "Теннис" }).click();

  await page.getByRole("button", { name: "Переименовать" }).click();
  let dialog = page.getByRole("dialog", { name: "Переименовать группу" });
  await dialog.getByLabel("Название").fill("семья");
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(
    dialog.getByText("Группа с таким названием уже есть")
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Переименовать" }).click();
  dialog = page.getByRole("dialog", { name: "Переименовать группу" });
  await dialog.getByLabel("Название").fill("Большой теннис");
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(dialog).toBeHidden();

  await expect(filter(page).getByRole("link")).toHaveText([
    "Все",
    "Большой теннис",
    "Семья",
  ]);
  await expect(page.getByText("В группе: 2")).toBeVisible();
  await expect(badges(page, "Борис")).toHaveText("Большой теннис");
});

test("delete a group: cancel keeps it, confirm removes only the group", async ({
  page,
}) => {
  await addFamilyAndTennis(page);
  await filter(page).getByRole("link", { name: "Теннис" }).click();

  await page.getByRole("button", { name: "Удалить" }).click();
  let dialog = page.getByRole("dialog", { name: "Удалить группу?" });
  await dialog.getByRole("button", { name: "Оставить" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("В группе: 2")).toBeVisible();

  await page.getByRole("button", { name: "Удалить" }).click();
  dialog = page.getByRole("dialog", { name: "Удалить группу?" });
  await dialog.getByRole("button", { name: "Удалить" }).click();

  await expect(page.getByText("Всего контактов: 3")).toBeVisible();
  await expect(filter(page).getByRole("link")).toHaveText(["Все", "Семья"]);
  await expect(badges(page, "Борис")).toBeHidden();
  await expect(badges(page, "Вера")).toHaveText("Семья");
});
