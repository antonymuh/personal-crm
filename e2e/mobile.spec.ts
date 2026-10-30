import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

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
