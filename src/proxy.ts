import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/sign-in"];

/**
 * Header set on every request that lets server components recover the
 * pathname + search string of the original URL. Next.js's App Router
 * deliberately does not expose the request URL to layouts/pages; we forward
 * it via this header so `(app)/layout.tsx` can build a `from=…` redirect
 * that preserves the user's full URL — including search params like
 * `?help=…` — across an invalid-cookie redirect to /sign-in.
 */
export const CURRENT_URL_HEADER = "x-current-url";

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = request.cookies.get("session")?.value;
  const fullPath = `${pathname}${search}`;

  if (!isPublicPath(pathname) && !session) {
    const signIn = new URL("/sign-in", request.url);
    // Preserve both pathname and search so deep links
    // (e.g. /sessions/abc?help=rules) survive the sign-in round-trip.
    signIn.searchParams.set("from", fullPath);
    return NextResponse.redirect(signIn);
  }

  // Note: we deliberately do NOT redirect `/sign-in -> /sessions` based on
  // cookie presence. The cookie may be present but invalid (expired, revoked,
  // or wiped on the server side). A presence-only redirect causes a loop with
  // the (app) layout, which redirects back to /sign-in when verification
  // fails. The /sign-in page server component handles the
  // "already signed in" redirect using full cryptographic verification.

  // Forward the full URL on every request so server components can recover
  // it (see `(app)/layout.tsx` building `from=…` for invalid-cookie
  // redirects).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CURRENT_URL_HEADER, fullPath);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
