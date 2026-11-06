import { and, eq, gt, like, lte, sql } from "drizzle-orm";

import { db, type Executor } from "@/db";
import { signInEmails, verification } from "@/db/schema";

// At most 3 sign-in emails per address within the last 10 minutes.
export const SIGN_IN_EMAIL_LIMIT = 3;
const WINDOW = sql`interval '10 minutes'`;

// Counts one more email to this address if the limit allows it. Returns false
// (and records nothing) when the address already got 3 emails in 10 minutes.
export async function takeSignInEmailSlot(
  email: string,
  executor: Executor = db
): Promise<boolean> {
  return executor.transaction(async (tx) => {
    // Two simultaneous requests for one address must not both slip under the limit.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${email}))`);
    await tx
      .delete(signInEmails)
      .where(
        and(
          eq(signInEmails.email, email),
          lte(signInEmails.sentAt, sql`now() - ${WINDOW}`)
        )
      );
    const recent = await tx.$count(
      signInEmails,
      and(
        eq(signInEmails.email, email),
        gt(signInEmails.sentAt, sql`now() - ${WINDOW}`)
      )
    );
    if (recent >= SIGN_IN_EMAIL_LIMIT) return false;
    await tx.insert(signInEmails).values({ email });
    return true;
  });
}

// A new link cancels the earlier ones: deletes the address's unused links
// (Better Auth stores them as identifier "magic-link:<token>").
export async function revokeSignInLinks(
  email: string,
  executor: Executor = db
): Promise<void> {
  await executor
    .delete(verification)
    .where(
      and(
        like(verification.identifier, "magic-link:%"),
        eq(sql`${verification.value}::jsonb ->> 'email'`, email)
      )
    );
}
