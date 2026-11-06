// The Mailpit inbox the app under test sends its emails to (SMTP_URL in
// playwright.config.ts). Tests read sign-in links from here, as a person
// would from their inbox.

export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";
export const MAILPIT_SMTP_URL =
  process.env.MAILPIT_SMTP_URL ?? "smtp://localhost:1025";

type Summary = { ID: string; To: { Address: string }[] };
export type Email = {
  ID: string;
  From: { Name: string; Address: string };
  To: { Address: string }[];
  Subject: string;
  Text: string;
  HTML: string;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${MAILPIT_URL}/api/v1${path}`, init);
  if (!response.ok) {
    throw new Error(`Mailpit ${path}: ${response.status}. Is it running?`);
  }
  return (init?.method === "DELETE" ? undefined : response.json()) as T;
}

export async function clearInbox(): Promise<void> {
  await api("/messages", { method: "DELETE" });
}

// All emails to the address, newest first.
export async function emailsTo(address: string): Promise<Email[]> {
  const query = encodeURIComponent(`to:"${address}"`);
  const { messages } = await api<{ messages: Summary[] }>(
    `/search?query=${query}`
  );
  return Promise.all(messages.map((m) => api<Email>(`/message/${m.ID}`)));
}

// Waits for the next email to the address (sending takes a moment).
export async function waitForEmails(
  address: string,
  count: number
): Promise<Email[]> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const emails = await emailsTo(address);
    if (emails.length >= count) return emails;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Expected ${count} email(s) to ${address} in Mailpit`);
}

// The link behind the «Войти» button.
export function signInLink(email: Email): string {
  const match = email.HTML.match(/<a [^>]*href="([^"]+)"[^>]*>Войти<\/a>/);
  if (!match) throw new Error(`No «Войти» link in "${email.Subject}"`);
  return match[1].replaceAll("&amp;", "&");
}
