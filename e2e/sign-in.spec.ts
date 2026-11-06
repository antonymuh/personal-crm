import type { Browser, Page } from "@playwright/test";

import { withE2eDatabase } from "./database";
import { expect, latestLink, requestLink, signIn, test } from "./fixtures";
import { emailsTo, signInLink, waitForEmails } from "./mailpit";

// Scenarios from openspec/changes/login/specs/user-sign-in/spec.md.

async function addContact(page: Page, name: string) {
  await page.getByRole("button", { name: "Добавить контакт" }).click();
  const dialog = page.getByRole("dialog", { name: "Новый контакт" });
  await dialog.getByLabel("Имя").fill(name);
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(dialog).toBeHidden();
}

// A second device: a browser that shares nothing with the first one.
async function onAnotherDevice<T>(
  browser: Browser,
  run: (page: Page) => Promise<T>
): Promise<T> {
  const context = await browser.newContext();
  try {
    return await run(await context.newPage());
  } finally {
    await context.close();
  }
}

async function expectSignInPage(page: Page) {
  await expect(page).toHaveURL("/sign-in");
  await expect(page.getByRole("heading", { name: "Вход" })).toBeVisible();
}

async function expectLinkExpired(page: Page) {
  await expect(page).toHaveURL(/\/sign-in\/expired/);
  await expect(
    page.getByRole("heading", { name: "Ссылка устарела, запроси новую" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Выйти" })).toBeHidden();
}

test.describe("without signing in", () => {
  test("the app shows the sign-in page", async ({ page }) => {
    await page.goto("/");

    await expectSignInPage(page);
    await expect(page.getByLabel("Почта")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Получить ссылку" })
    ).toBeVisible();
  });

  test("a direct link to a contact shows the sign-in page", async ({
    page,
    browser,
  }) => {
    await signIn(page);
    await addContact(page, "Анна Смирнова");
    await page.getByRole("link", { name: /Анна Смирнова/ }).click();
    await expect(page).toHaveURL(/\/contacts\/\d+$/);
    const cardUrl = page.url();

    await onAnotherDevice(browser, async (other) => {
      await other.goto(cardUrl);
      await expectSignInPage(other);
      await expect(other.getByText("Анна Смирнова")).toBeHidden();
    });
  });

  test("a request to change data changes nothing", async ({
    page,
    playwright,
  }) => {
    await signIn(page);
    // Record what the «Добавить контакт» form sends to the server...
    const sent = page.waitForRequest(
      (r) => r.method() === "POST" && !!r.headers()["next-action"]
    );
    await addContact(page, "Анна");
    const request = await sent;

    // ...and send the same thing again without the session cookie.
    const anonymous = await playwright.request.newContext();
    try {
      const headers = await request.allHeaders();
      delete headers.cookie;
      await anonymous.post(request.url(), {
        headers,
        data: request.postDataBuffer() ?? undefined,
        maxRedirects: 0,
      });
    } finally {
      await anonymous.dispose();
    }

    const [{ count }] = await withE2eDatabase(
      (sql) => sql<{ count: number }[]>`select count(*)::int from contacts`
    );
    expect(count).toBe(1);
  });

  test("the health check still answers", async ({ request }) => {
    const response = await request.get("/health");
    expect(response.ok()).toBe(true);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});

test.describe("requesting a link", () => {
  test("shows where the link went, keeps the form and sends the email", async ({
    page,
  }) => {
    await requestLink(page, "anna@example.com");

    await expect(page.getByLabel("Почта")).toHaveValue("anna@example.com");
    await expect(
      page.getByRole("button", { name: "Получить ссылку" })
    ).toBeVisible();
    const [email] = await waitForEmails("anna@example.com", 1);
    expect(signInLink(email)).toContain("/api/auth/magic-link/verify");
  });

  test("ignores spaces and letter case in the address", async ({
    page,
    browser,
  }) => {
    await requestLink(page, "  Anna@Example.COM  ");
    await page.goto(await latestLink("anna@example.com"));
    await addContact(page, "Борис");

    // The lowercase address is the same user.
    await onAnotherDevice(browser, async (other) => {
      await signIn(other, "anna@example.com");
      await expect(other.getByText("Борис")).toBeVisible();
    });
  });

  test("answers the same for a known and a new address", async ({
    page,
    browser,
  }) => {
    await onAnotherDevice(browser, (other) =>
      signIn(other, "known@example.com")
    );

    await requestLink(page, "known@example.com");
    const known = await page.getByRole("status").textContent();
    await requestLink(page, "new@example.com");
    const fresh = await page.getByRole("status").textContent();

    expect(known?.replace("known", "X")).toBe(fresh?.replace("new", "X"));
  });

  test("an invalid address shows an error and sends nothing", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Почта").fill("anna@");
    await page.getByRole("button", { name: "Получить ссылку" }).click();

    await expect(page.getByText("Проверь адрес почты")).toBeVisible();
    await expect(page.getByLabel("Почта")).toHaveValue("anna@");
    expect(await emailsTo("anna@")).toEqual([]);
  });

  test("the 4th request within 10 minutes is refused", async ({ page }) => {
    for (let i = 0; i < 3; i++) await requestLink(page, "anna@example.com");

    await page.getByRole("button", { name: "Получить ссылку" }).click();

    await expect(
      page.getByText("Слишком часто, попробуй через несколько минут")
    ).toBeVisible();
    expect(await emailsTo("anna@example.com")).toHaveLength(3);
  });
});

test.describe("the email", () => {
  test("comes from the app and explains the link", async ({ page }) => {
    await requestLink(page, "anna@example.com");

    const [email] = await waitForEmails("anna@example.com", 1);
    expect(email.From).toEqual({
      Name: "Личная CRM",
      Address: "noreply@mail.crm.pocketcrm.co",
    });
    expect(email.Subject).toBe("Вход в Личную CRM");
    expect(email.HTML).toMatch(/>Войти<\/a>/);
    expect(email.Text).toContain("Ссылка работает 15 минут.");
    expect(email.Text).toContain(
      "Если вы не запрашивали вход - просто проигнорируйте письмо"
    );
  });
});

test.describe("opening the link", () => {
  test("signs in and shows the user's contacts", async ({ page }) => {
    await signIn(page, "anna@example.com");
    await expect(page.getByRole("heading", { name: "Контакты" })).toBeVisible();
  });

  test("the first sign-in is the sign-up: no form, an empty list", async ({
    page,
  }) => {
    await requestLink(page, "new@example.com");
    await page.goto(await latestLink("new@example.com"));

    await expect(page).toHaveURL("/");
    await expect(page.getByText("Всего контактов: 0")).toBeVisible();
    await expect(
      page.getByText("Пока нет контактов. Добавьте первый.")
    ).toBeVisible();
  });

  test("a used link is expired", async ({ page }) => {
    await signIn(page, "anna@example.com");
    const link = await latestLink("anna@example.com");
    await page.getByRole("button", { name: "Выйти" }).click();
    await expectSignInPage(page);

    await page.goto(link);

    await expectLinkExpired(page);
  });

  test("a link older than 15 minutes is expired", async ({ page }) => {
    await requestLink(page, "anna@example.com");
    await withE2eDatabase(
      (sql) =>
        sql`update verification set expires_at = now() - interval '1 minute'`
    );

    await page.goto(await latestLink("anna@example.com"));

    await expectLinkExpired(page);
  });

  test("a new link cancels the earlier one", async ({ page }) => {
    await requestLink(page, "anna@example.com");
    const first = await latestLink("anna@example.com");
    await requestLink(page, "anna@example.com");
    const second = await latestLink("anna@example.com", 2);

    await page.goto(first);
    await expectLinkExpired(page);

    await page.goto(second);
    await expect(page).toHaveURL("/");
  });

  test("the expired page leads back to the sign-in page", async ({ page }) => {
    await page.goto("/sign-in/expired");

    await page.getByRole("link", { name: "Получить новую ссылку" }).click();

    await expectSignInPage(page);
  });
});

test.describe("staying signed in", () => {
  const sessionExpiresInDays = (email: string) =>
    withE2eDatabase(async (sql) => {
      const [{ days }] = await sql<{ days: number }[]>`
        select extract(epoch from (s.expires_at - now())) / 86400 as days
        from session s join "user" u on u.id = s.user_id
        where u.email = ${email}`;
      return Number(days);
    });

  test("coming back after a week keeps the user in", async ({ page }) => {
    await signIn(page, "anna@example.com");
    // As if the last visit was a week ago.
    await withE2eDatabase(
      (sql) => sql`update session set
        expires_at = now() + interval '23 days',
        updated_at = now() - interval '7 days'`
    );

    await page.goto("/");

    await expect(page).toHaveURL("/");
    await expect(page.getByText("anna@example.com")).toBeVisible();
    expect(await sessionExpiresInDays("anna@example.com")).toBeGreaterThan(
      29.9
    );
  });

  test("after more than 30 days away the sign-in page shows", async ({
    page,
  }) => {
    await signIn(page, "anna@example.com");
    await withE2eDatabase(
      (sql) => sql`update session set expires_at = now() - interval '1 minute'`
    );

    await page.goto("/");

    await expectSignInPage(page);
  });

  test("two devices stay signed in at once", async ({ page, browser }) => {
    await signIn(page, "anna@example.com");
    await onAnotherDevice(browser, async (other) => {
      await signIn(other, "anna@example.com");

      await page.reload();
      await other.reload();

      await expect(page.getByText("anna@example.com")).toBeVisible();
      await expect(other.getByText("anna@example.com")).toBeVisible();
    });
  });
});

test.describe("the header and signing out", () => {
  test("shows the user's email and «Выйти»", async ({ page }) => {
    await signIn(page, "anna@example.com");

    const header = page.getByRole("banner");
    await expect(header.getByText("anna@example.com")).toBeVisible();
    await expect(header.getByRole("button", { name: "Выйти" })).toBeVisible();
  });

  test("«Выйти» leads to the sign-in page and closes the app", async ({
    page,
  }) => {
    await signIn(page, "anna@example.com");

    await page.getByRole("button", { name: "Выйти" }).click();
    await expectSignInPage(page);

    await page.goto("/");
    await expectSignInPage(page);
  });

  test("«Выйти» signs out only this device", async ({ page, browser }) => {
    await signIn(page, "anna@example.com");
    await onAnotherDevice(browser, async (other) => {
      await signIn(other, "anna@example.com");

      await page.getByRole("button", { name: "Выйти" }).click();
      await expectSignInPage(page);

      await other.reload();
      await expect(other).toHaveURL("/");
      await expect(other.getByText("anna@example.com")).toBeVisible();
    });
  });
});
