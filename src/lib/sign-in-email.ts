// The email with the sign-in link. The sender address is fixed by the spec;
// where emails go (Mailpit or Resend) is decided by SMTP_URL, see src/lib/mail.ts.

export const SIGN_IN_LINK_MINUTES = 15;

const FROM = '"Личная CRM" <noreply@mail.crm.pocketcrm.co>';
const SUBJECT = "Вход в Личную CRM";
const IGNORE = "Если вы не запрашивали вход - просто проигнорируйте письмо";

// Email clients ignore stylesheets and CSS variables, so the app's design
// tokens (src/app/globals.css) are repeated here as plain values.
const INK = "#1b1b1f";
const INK_MUTED = "#55534c";
const PAPER = "#fffef7";
const YELLOW = "#ffd23f";

export type SignInEmail = {
  from: string;
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function buildSignInEmail(url: string): SignInEmail {
  const lifetime = `Ссылка работает ${SIGN_IN_LINK_MINUTES} минут.`;
  const html = `<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:24px;background:${PAPER};color:${INK};font-family:Arial,sans-serif;font-size:16px;line-height:1.5">
    <p style="margin:0 0 20px">Нажмите кнопку, чтобы войти в Личную CRM.</p>
    <p style="margin:0 0 20px">
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;background:${YELLOW};color:${INK};border:2px solid ${INK};border-radius:10px;font-weight:bold;text-decoration:none">Войти</a>
    </p>
    <p style="margin:0 0 8px">${lifetime}</p>
    <p style="margin:0;color:${INK_MUTED}">${IGNORE}</p>
  </body>
</html>`;
  const text = [
    "Чтобы войти в Личную CRM, откройте ссылку:",
    url,
    "",
    lifetime,
    IGNORE,
  ].join("\n");
  return { from: FROM, subject: SUBJECT, html, text };
}
