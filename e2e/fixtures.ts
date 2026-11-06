import { expect, test as base, type Page } from "@playwright/test";

import { resetE2eDatabase } from "./database";
import { clearInbox, emailsTo, signInLink, waitForEmails } from "./mailpit";

// The user the scenarios of the other features run as.
export const OWNER = "owner@example.com";

// Every test starts with an empty database and an empty inbox.
export const test = base.extend<{ cleanDatabase: void }>({
  cleanDatabase: [
    async ({}, use) => {
      await resetE2eDatabase();
      await clearInbox();
      await use();
    },
    { auto: true },
  ],
});

// Asks for a link on the sign-in page; returns once the page confirms it.
export async function requestLink(page: Page, email: string): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Почта").fill(email);
  await page.getByRole("button", { name: "Получить ссылку" }).click();
  await expect(
    page.getByText(
      `Ссылка для входа отправлена на ${email.trim().toLowerCase()}`
    )
  ).toBeVisible();
}

// The link from the newest email to the address.
export async function latestLink(address: string, count = 1): Promise<string> {
  const [latest] = await waitForEmails(address, count);
  return signInLink(latest);
}

// Signs in the way a person does: the form, the email in Mailpit, the link.
export async function signIn(page: Page, email: string = OWNER): Promise<void> {
  const address = email.trim().toLowerCase();
  const before = (await emailsTo(address)).length;
  await requestLink(page, email);
  await page.goto(await latestLink(address, before + 1));
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Выйти" })).toBeVisible();
}

export { expect };
