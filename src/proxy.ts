import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/sign-in"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get("session")?.value;

  if (!isPublicPath(pathname) && !session) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("from", pathname);
    return NextResponse.redirect(signIn);
  }

  // Note: we deliberately do NOT redirect `/sign-in -> /sessions` based on
  // cookie presence. The cookie may be present but invalid (expired, revoked,
  // or wiped on the server side). A presence-only redirect causes a loop with
  // the (app) layout, which redirects back to /sign-in when verification
  // fails. The /sign-in page server component handles the
  // "already signed in" redirect using full cryptographic verification.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
