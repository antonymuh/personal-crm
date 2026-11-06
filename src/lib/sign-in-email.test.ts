import { describe, expect, it } from "vitest";

import { buildSignInEmail } from "@/lib/sign-in-email";

const url = "https://app.example.com/api/auth/magic-link/verify?token=abc&x=1";

describe("buildSignInEmail", () => {
  const email = buildSignInEmail(url);

  it("comes from the app's sender address", () => {
    expect(email.from).toBe('"Личная CRM" <noreply@mail.crm.pocketcrm.co>');
  });

  it("has the sign-in subject", () => {
    expect(email.subject).toBe("Вход в Личную CRM");
  });

  it("has a «Войти» button with the link", () => {
    expect(email.html).toMatch(
      /<a [^>]*href="https:\/\/app\.example\.com\/api\/auth\/magic-link\/verify\?token=abc&amp;x=1"[^>]*>Войти<\/a>/
    );
  });

  it("says the link works 15 minutes and how to ignore it", () => {
    for (const body of [email.html, email.text]) {
      expect(body).toContain("15 минут");
      expect(body).toContain(
        "Если вы не запрашивали вход - просто проигнорируйте письмо"
      );
    }
  });

  it("has the link in the plain-text version", () => {
    expect(email.text).toContain(url);
  });
});
