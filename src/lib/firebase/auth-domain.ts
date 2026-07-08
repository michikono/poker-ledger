/**
 * Same-origin auth handler resolution (ADR 0011, spec 0035).
 *
 * Google Sign-In routes the OAuth exchange through a helper page at
 * `https://{authDomain}/__/auth/handler`. When `authDomain` is a different
 * origin from the app (`*.firebaseapp.com` vs the Vercel host), the
 * `sessionStorage` nonce the SDK writes is third-party and gets partitioned
 * away on mobile browsers, producing the "missing initial state" error. Serving
 * the handler same-origin as the app makes the nonce first-party.
 */

export interface AuthHandlerRewrite {
  source: string;
  destination: string;
}

/**
 * The `authDomain` to initialize the client SDK with.
 *
 * Real projects use the app's own host so the OAuth handler is same-origin;
 * demo projects (and any non-browser context) keep the env value so the local
 * Auth emulator flow is untouched.
 */
export function resolveAuthDomain(
  envAuthDomain: string,
  host: string | undefined,
  isDemoProject: boolean,
): string {
  if (isDemoProject) return envAuthDomain;
  if (host) return host;
  return envAuthDomain;
}

/**
 * Next.js rewrites that proxy the Firebase auth handler paths to the project's
 * `firebaseapp.com` host, so `/__/auth/handler` is served first-party while
 * still running Firebase's real handler code. Destination host is derived from
 * `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` so the project id lives in one place.
 */
export function authHandlerRewrites(
  envAuthDomain: string,
): AuthHandlerRewrite[] {
  if (!envAuthDomain) return [];
  const base = `https://${envAuthDomain}`;
  return [
    { source: "/__/auth/:path*", destination: `${base}/__/auth/:path*` },
    {
      source: "/__/firebase/:path*",
      destination: `${base}/__/firebase/:path*`,
    },
  ];
}
