"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { TOO_MANY_REQUESTS, getAuth } from "@/lib/auth";
import { INVALID_EMAIL, parseEmail } from "@/lib/email";
import { SIGN_IN_PATH } from "@/lib/session";

export type SignInState =
  | { status: "sent"; email: string }
  | { status: "invalid"; email: string; error: string }
  | { status: "limited"; email: string; error: string };

function errorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null || !("body" in err)) return;
  const body = (err as { body?: { code?: unknown } }).body;
  return typeof body?.code === "string" ? body.code : undefined;
}

// «Получить ссылку». The answer is the same whether or not the address
// already belongs to a user; the server-side rules live in src/lib/auth.ts.
export async function requestSignInLink(
  _prev: SignInState | null,
  formData: FormData
): Promise<SignInState> {
  const raw = formData.get("email");
  const typed = typeof raw === "string" ? raw : "";
  const parsed = parseEmail(raw);
  if (!parsed.ok)
    return { status: "invalid", email: typed, error: parsed.error };

  try {
    await getAuth().api.signInMagicLink({
      body: { email: parsed.email },
      headers: await headers(),
    });
  } catch (err) {
    const code = errorCode(err);
    if (code === "TOO_MANY_REQUESTS") {
      return { status: "limited", email: typed, error: TOO_MANY_REQUESTS };
    }
    if (code === "INVALID_EMAIL" || code === "VALIDATION_ERROR") {
      return { status: "invalid", email: typed, error: INVALID_EMAIL };
    }
    throw err;
  }
  return { status: "sent", email: parsed.email };
}

// «Выйти»: ends the session of this device only.
export async function signOut(): Promise<void> {
  await getAuth().api.signOut({ headers: await headers() });
  redirect(SIGN_IN_PATH);
}
