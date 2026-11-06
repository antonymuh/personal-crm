import { NextResponse, type NextRequest } from "next/server";

import { getAuth } from "@/lib/auth";

// Sends visitors without a session to the sign-in page, and extends the
// session cookie on every visit (Server Components cannot set cookies).
// Pages and Server Actions still check the session themselves (requireUser).
export async function proxy(request: NextRequest) {
  const { headers, response: session } = await getAuth().api.getSession({
    headers: request.headers,
    returnHeaders: true,
  });

  if (!session) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const response = NextResponse.next();
  for (const cookie of headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}

export const config = {
  // Everything except the sign-in pages, the auth endpoints, the health check
  // and static files.
  matcher: [
    "/((?!sign-in|api/auth|health|_next/static|_next/image|fonts/|favicon\\.ico|.*\\.(?:svg|png|ico|woff2)$).*)",
  ],
};
