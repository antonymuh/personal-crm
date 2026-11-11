import { expect, signIn, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("an unknown address shows the app's own page in Russian", async ({
  page,
}) => {
  const response = await page.goto("/no-such-page");

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Страница не найдена" })
  ).toBeVisible();

  await page.getByRole("link", { name: "Ко всем контактам" }).click();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("button", { name: "Добавить контакт" })
  ).toBeVisible();
});
