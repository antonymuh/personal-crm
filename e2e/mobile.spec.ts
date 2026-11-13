import type { Locator, Page } from "@playwright/test";

import { birthDateFor } from "./dates";
import { withE2eDatabase } from "./database";
import { expect, OWNER, signIn, test } from "./fixtures";

// Without signing in the app shows only the sign-in page.
test.beforeEach(async ({ page }) => {
  await signIn(page);
});

// A narrow phone screen.
const WIDTH = 360;
test.use({ viewport: { width: WIDTH, height: 740 } });

async function expectNoSideScroll(page: Page) {
  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth
  );
  expect(scrollWidth).toBeLessThanOrEqual(WIDTH);
}

async function expectInsideScreen(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(WIDTH);
}

test("the contact card fits a phone screen, delete included", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  const form = page.getByRole("dialog", { name: "Новый контакт" });
  await form.getByLabel("Имя").fill("Анна Смирнова");
  await form.getByRole("button", { name: "Сохранить" }).click();
  await expect(form).toBeHidden();

  await page.getByRole("link", { name: /Анна Смирнова/ }).click();
  await expect(page).toHaveURL(/\/contacts\/\d+$/);

  await expectInsideScreen(page.getByRole("button", { name: "Изменить" }));
  const remove = page.getByRole("button", { name: "Удалить" });
  await expectInsideScreen(remove);
  await expectNoSideScroll(page);

  await remove.click();
  const confirm = page.getByRole("dialog", { name: "Точно удалить?" });
  await expectInsideScreen(confirm);
  await expectInsideScreen(
    confirm.getByRole("button", { name: "Оставлю, пришлю открытку" })
  );
  await expectInsideScreen(confirm.getByRole("button", { name: "Удалить" }));
  await expectNoSideScroll(page);
});

test("the birthdays block and the birth date field fit a phone screen", async ({
  page,
}) => {
  await withE2eDatabase(
    (sql) => sql`
      insert into contacts (user_id, name, birth_date)
      select id, 'Очень-Очень-Длинное-Имя-Именинницы Александровна-Петровская',
        ${birthDateFor(1, 28)}
      from "user" where email = ${OWNER}`
  );
  await page.goto("/");

  const block = page.getByRole("region", { name: "Скоро день рождения" });
  await expect(block).toBeVisible();
  await expectInsideScreen(block);
  await expectNoSideScroll(page);

  await page.getByRole("button", { name: "Добавить контакт" }).click();
  const form = page.getByRole("dialog", { name: "Новый контакт" });
  const field = form.getByLabel("Дата рождения");
  await field.scrollIntoViewIfNeeded();
  await expectInsideScreen(field);
  await expectNoSideScroll(page);
});
