import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { signInEmails, verification } from "@/db/schema";
import { createAuth } from "@/lib/auth";
import type { SendMail } from "@/lib/mail";
import { addUser, resetDatabase } from "../../test/db";

const baseURL = "http://localhost:3000";
type Sent = Parameters<SendMail>[0];

let sent: Sent[];
let auth: ReturnType<typeof createAuth>;

beforeEach(async () => {
  await resetDatabase();
  sent = [];
  auth = createAuth({
    baseURL,
    secret: "test-secret-test-secret-test-secret",
    sendMail: async (message) => {
      sent.push(message);
    },
  });
});

function requestLink(email: string) {
  return auth.api.signInMagicLink({ body: { email }, headers: new Headers() });
}

// The link from the «Войти» button of a sent email.
function linkOf(message: Sent): string {
  const match = message.text.match(/https?:\/\/\S+/);
  if (!match) throw new Error("no link in the email");
  return match[0];
}

async function errorCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (err) {
    return (err as { body?: { code?: string } }).body?.code ?? String(err);
  }
  throw new Error("expected the request to fail");
}

async function openLink(link: string): Promise<Response> {
  return auth.handler(new Request(link, { redirect: "manual" }));
}

// Where the browser goes after opening a link: the path on our site.
function redirectPath(response: Response): string {
  const location = new URL(response.headers.get("location") ?? "", baseURL);
  expect(location.origin).toBe(baseURL);
  return location.pathname;
}

describe("requesting a sign-in link", () => {
  it("sends the link to the trimmed, lowercased address", async () => {
    await requestLink("  Anna@Example.COM  ");
    expect(sent.map((m) => m.to)).toEqual(["anna@example.com"]);
    expect(sent[0].subject).toBe("Вход в Личную CRM");
  });

  it("answers the same for a new and a known address", async () => {
    await addUser("known@example.com");
    expect(await requestLink("known@example.com")).toEqual(
      await requestLink("new@example.com")
    );
    expect(sent).toHaveLength(2);
  });

  it("refuses an invalid address and sends nothing", async () => {
    expect(await errorCode(requestLink("anna@"))).toBe("INVALID_EMAIL");
    expect(sent).toEqual([]);
  });

  it("refuses the 4th email to one address within 10 minutes", async () => {
    for (let i = 0; i < 3; i++) await requestLink("anna@example.com");

    expect(await errorCode(requestLink("Anna@example.com"))).toBe(
      "TOO_MANY_REQUESTS"
    );
    expect(sent).toHaveLength(3);
  });

  it("counts the limit per address", async () => {
    for (let i = 0; i < 3; i++) await requestLink("anna@example.com");
    await requestLink("boris@example.com");
    expect(sent.map((m) => m.to)).toContain("boris@example.com");
  });

  it("sends again once the first email is older than 10 minutes", async () => {
    for (let i = 0; i < 3; i++) await requestLink("anna@example.com");
    await db.execute(
      sql`update ${signInEmails} set sent_at = sent_at - interval '11 minutes'`
    );

    await requestLink("anna@example.com");

    expect(sent).toHaveLength(4);
  });

  it("keeps only the newest link of the address", async () => {
    await requestLink("anna@example.com");
    await requestLink("boris@example.com");
    await requestLink("anna@example.com");

    expect(await db.$count(verification)).toBe(2);
  });
});

describe("opening a sign-in link", () => {
  it("signs in and creates the user on the first sign-in", async () => {
    await requestLink("anna@example.com");

    const response = await openLink(linkOf(sent[0]));

    expect(response.status).toBe(302);
    expect(redirectPath(response)).toBe("/");
    expect(response.headers.get("set-cookie")).toContain("session_token");
  });

  it("sends an old link to the expired page", async () => {
    await requestLink("anna@example.com");
    await requestLink("anna@example.com");

    const response = await openLink(linkOf(sent[0]));

    expect(redirectPath(response)).toBe("/sign-in/expired");
  });

  it("works only once", async () => {
    await requestLink("anna@example.com");
    const link = linkOf(sent[0]);
    await openLink(link);

    const again = await openLink(link);

    expect(redirectPath(again)).toBe("/sign-in/expired");
  });

  it("stops working after 15 minutes", async () => {
    await requestLink("anna@example.com");
    await db.execute(
      sql`update ${verification} set expires_at = now() - interval '1 minute'`
    );

    const response = await openLink(linkOf(sent[0]));

    expect(redirectPath(response)).toBe("/sign-in/expired");
  });

  it("expires 15 minutes after the request", async () => {
    await requestLink("anna@example.com");
    const [row] = await db.select().from(verification);
    const minutes = (row.expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(14);
    expect(minutes).toBeLessThanOrEqual(15);
  });
});

describe("a request that bypasses the form", () => {
  function post(body: unknown) {
    return auth.handler(
      new Request(`${baseURL}/api/auth/sign-in/magic-link`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: baseURL },
        body: JSON.stringify(body),
      })
    );
  }

  it("is refused for an invalid address", async () => {
    const response = await post({ email: "anna@" });
    expect(response.status).toBe(400);
    expect(sent).toEqual([]);
  });

  it("is limited like the form", async () => {
    for (let i = 0; i < 3; i++) await post({ email: "anna@example.com" });
    const response = await post({ email: "anna@example.com" });
    expect(response.status).toBe(429);
    expect(sent).toHaveLength(3);
  });

  it("cannot send the user somewhere else after sign-in", async () => {
    await post({
      email: "anna@example.com",
      callbackURL: "https://evil.example/",
      errorCallbackURL: "https://evil.example/",
    });

    const link = new URL(linkOf(sent[0]));
    expect(link.origin).toBe(baseURL);
    expect(link.searchParams.get("callbackURL")).toBe("/");
    expect(link.searchParams.get("errorCallbackURL")).toBe("/sign-in/expired");
  });
});
