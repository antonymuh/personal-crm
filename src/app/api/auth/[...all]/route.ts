import { getAuth } from "@/lib/auth";

// Better Auth endpoints; the link from a sign-in email opens
// /api/auth/magic-link/verify here.

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return getAuth().handler(request);
}

export function POST(request: Request) {
  return getAuth().handler(request);
}
