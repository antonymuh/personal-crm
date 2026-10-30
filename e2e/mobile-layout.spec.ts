import { expect, test } from "./fixtures";

// A phone-sized screen: the contact card must not be wider than the screen.
test.use({ viewport: { width: 375, height: 667 } });

test("contact page does not scroll sideways on a phone", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  const dialog = page.getByRole("dialog", { name: "Новый контакт" });
  // One long word: it cannot wrap, so it is the worst case for the header.
  await dialog.getByLabel("Имя").fill("Константинопольский-Подкопаев");
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("link", { name: /Константинопольский/ }).click();
  await expect(page).toHaveURL(/\/contacts\/\d+$/);

  const deleteButton = page.getByRole("button", { name: "Удалить" });
  await expect(deleteButton).toBeVisible();
  const box = await deleteButton.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
