import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "@/lib/auth";

export type CurrentUser = { id: string; email: string };

export const SIGN_IN_PATH = "/sign-in";

// The signed-in user of this request, or null. Cached per request, so the
// layout, the page and its data share one session lookup.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Reading the headers first marks the page dynamic before the auth settings
  // are needed, so `next build` never creates Better Auth.
  const requestHeaders = await headers();
  const result = await getAuth().api.getSession({ headers: requestHeaders });
  return result ? { id: result.user.id, email: result.user.email } : null;
});

// Every page and Server Action starts here: no session means the sign-in
// page, and nothing is read or changed. src/proxy.ts is only a first line.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(SIGN_IN_PATH);
  return user;
}
