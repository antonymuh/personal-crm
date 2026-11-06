// The sign-in email address: one rule for the form and for the server, so a
// request that bypasses the form is checked the same way.

export const INVALID_EMAIL = "Проверь адрес почты";

// Something@domain.tld without spaces; the mail server does the rest.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const MAX_LENGTH = 254;

export type ParsedEmail =
  { ok: true; email: string } | { ok: false; error: string };

// Trims spaces and ignores letter case: " Anna@Example.COM " is anna@example.com.
export function parseEmail(raw: unknown): ParsedEmail {
  if (typeof raw !== "string") return { ok: false, error: INVALID_EMAIL };
  const email = raw.trim().toLowerCase();
  if (email.length > MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: INVALID_EMAIL };
  }
  return { ok: true, email };
}
