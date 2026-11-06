import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";

import { db } from "@/db";
import { account, session, user, verification } from "@/db/schema";
import { revokeSignInLinks, takeSignInEmailSlot } from "@/db/sign-in-emails";
import { INVALID_EMAIL, parseEmail } from "@/lib/email";
import { sendMail as sendMailOverSmtp, type SendMail } from "@/lib/mail";
import { SIGN_IN_LINK_MINUTES, buildSignInEmail } from "@/lib/sign-in-email";

// Sign-in by a link from an email (Better Auth, magic link). The rules for
// requesting a link live in the before hook, so they apply both to the form
// (auth.api.signInMagicLink from a Server Action) and to a direct HTTP request.

export const SIGNED_IN_PATH = "/";
export const LINK_EXPIRED_PATH = "/sign-in/expired";
export const TOO_MANY_REQUESTS =
  "Слишком часто, попробуй через несколько минут";

const DAY = 60 * 60 * 24;

export function createAuth({
  sendMail,
  baseURL = process.env.BETTER_AUTH_URL,
  secret = process.env.BETTER_AUTH_SECRET,
}: {
  sendMail: SendMail;
  baseURL?: string;
  secret?: string;
}) {
  return betterAuth({
    appName: "Личная CRM",
    baseURL,
    secret,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    // The only limit the spec asks for is per address (see the hook below).
    rateLimit: { enabled: false },
    session: {
      // Signed in for 30 days since the last visit on this device; the expiry
      // moves forward at most once an hour.
      expiresIn: 30 * DAY,
      updateAge: 60 * 60,
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/magic-link") return;

        const parsed = parseEmail(ctx.body?.email);
        if (!parsed.ok) {
          throw new APIError("BAD_REQUEST", {
            code: "INVALID_EMAIL",
            message: INVALID_EMAIL,
          });
        }
        const { email } = parsed;
        if (!(await takeSignInEmailSlot(email))) {
          throw new APIError("TOO_MANY_REQUESTS", {
            code: "TOO_MANY_REQUESTS",
            message: TOO_MANY_REQUESTS,
          });
        }
        await revokeSignInLinks(email);

        // Where the link leads is ours to decide, not the caller's.
        return {
          context: {
            body: {
              ...ctx.body,
              email,
              callbackURL: SIGNED_IN_PATH,
              newUserCallbackURL: SIGNED_IN_PATH,
              errorCallbackURL: LINK_EXPIRED_PATH,
            },
          },
        };
      }),
    },
    plugins: [
      magicLink({
        expiresIn: SIGN_IN_LINK_MINUTES * 60,
        sendMagicLink: async ({ email, url }) => {
          await sendMail({ ...buildSignInEmail(url), to: email });
        },
      }),
      // Lets Server Actions set and clear the session cookie.
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

// Created on first use: `next build` loads this module without the sign-in
// settings, which are only needed when the app actually runs.
let instance: Auth | undefined;

export function getAuth(): Auth {
  instance ??= createAuth({ sendMail: sendMailOverSmtp });
  return instance;
}
