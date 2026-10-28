import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// Scenarios from openspec/specs/keep-in-touch/spec.md.

async function addContact(page: Page, name: string, frequency?: string) {
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  const dialog = page.getByRole("dialog", { name: "Новый контакт" });
  await dialog.getByLabel("Имя").fill(name);
  if (frequency) {
    await dialog
      .getByLabel("Частота общения")
      .selectOption({ label: frequency });
  }
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(dialog).toBeHidden();
}

const contactRows = (page: Page) =>
  page.getByRole("link", { name: /^(Анна|Яна)/ });

test("a contact due for a call goes first; «Пообщались» clears it", async ({
  page,
}) => {
  await page.goto("/");
  await addContact(page, "Анна");
  await addContact(page, "Яна", "Раз в месяц");

  // Never contacted with a frequency set: due now, shown above alphabetical order.
  await expect(contactRows(page).first()).toContainText("Яна");
  await expect(contactRows(page).first()).toContainText("Пора связаться");
  await expect(contactRows(page).nth(1)).not.toContainText("Пора связаться");

  await contactRows(page).first().click();
  await expect(page.getByText("Частота: Раз в месяц")).toBeVisible();
  await expect(
    page.getByText("Последнее общение: ещё не отмечали")
  ).toBeVisible();
  await expect(page.getByText("Пора связаться")).toBeVisible();

  await page.getByRole("button", { name: "Пообщались" }).click();
  await expect(page.getByText("Пора связаться")).toBeHidden();
  await expect(
    page.getByText("Последнее общение: ещё не отмечали")
  ).toBeHidden();

  // A note does not count as contact: the date stays the same.
  const lastContacted = await page
    .getByText(/^Последнее общение:/)
    .textContent();
  await page
    .getByPlaceholder("О чём договорились, что обсудили…")
    .fill("Созвонились");
  await page.getByRole("button", { name: "Добавить заметку" }).click();
  await expect(page.getByText("Созвонились")).toBeVisible();
  await expect(page.getByText(/^Последнее общение:/)).toHaveText(
    lastContacted!
  );

  await page.getByRole("link", { name: "Ко всем контактам" }).click();
  await expect(contactRows(page)).toHaveText([/^Анна/, /^Яна/]);
  await expect(page.getByText("Пора связаться")).toBeHidden();
});

test("no frequency — never due", async ({ page }) => {
  await page.goto("/");
  await addContact(page, "Анна");

  await page.getByRole("link", { name: /^Анна/ }).click();
  await expect(page.getByText("Частота: не задана")).toBeVisible();
  await expect(page.getByText("Пора связаться")).toBeHidden();
  await expect(page.getByText(/^Следующий раз:/)).toBeHidden();
});
