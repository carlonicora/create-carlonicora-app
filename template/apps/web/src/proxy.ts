import { hasLocale } from "next-intl";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { ENV } from "@/config/middleware-env";

const intlMiddleware = createMiddleware(routing);

/**
 * Paths reachable without a session.
 *
 * "/" is matched EXACTLY; everything else by prefix. Prefix-matching "/" is what
 * made `isExempt` unconditionally true and turned the redirect below into dead
 * code — every pathname starts with "/".
 */
const EXEMPT_EXACT = new Set(["/"]);
const EXEMPT_PREFIXES = [
  // the (auth) route group
  "/activation",
  "/auth",
  "/invitation",
  "/login",
  "/logout",
  "/oauth",
  "/register",
  "/reset",
  // the (public-help) route group — deliberately unauthenticated
  "/help",
  // the PWA offline fallback. It has no dot, so the matcher below does NOT
  // exempt it; an auth-gated /offline would precache a redirect and the offline
  // page would never render.
  "/offline",
];

/**
 * Removes a leading locale segment.
 *
 * Two fixes over the previous inline regex: it accepts a BARE locale ("/en" →
 * "/"), and it only strips segments that are actually configured locales, so a
 * two-letter route segment is never eaten.
 */
export function stripLocalePrefix(pathname: string): string {
  const segment = pathname.match(/^\/([a-z]{2})(?=\/|$)/)?.[1];
  if (!segment || !hasLocale(routing.locales, segment)) return pathname;
  return pathname.slice(segment.length + 1) || "/";
}

export function isExemptPath(normalizedPathname: string): boolean {
  if (EXEMPT_EXACT.has(normalizedPathname)) return true;
  return EXEMPT_PREFIXES.some((path) => normalizedPathname === path || normalizedPathname.startsWith(`${path}/`));
}

async function getNewToken(refreshToken: string): Promise<string | null> {
  try {
    const headers: HeadersInit = {};
    const options: RequestInit = { method: "POST", headers: headers };
    const uri = `${ENV.PUBLIC_API_URL}auth/refreshtoken/${refreshToken}`;
    const tokenRefreshResponse = await fetch(uri, options);

    if (tokenRefreshResponse.ok) {
      const data = await tokenRefreshResponse.json();
      return data.data.attributes.token;
    }

    return null;
  } catch (error) {
    return null;
  }
}

function isTokenCloseToExpiry(token: string): boolean {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
    const exp = payload.exp;
    const currentTime = Math.floor(Date.now() / 1000);
    return exp - currentTime < 300;
  } catch (error) {
    return false;
  }
}

export default async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  const normalizedPathname = stripLocalePrefix(pathname);
  const isExempt = isExemptPath(normalizedPathname);

  const refreshToken = request.cookies.get("refreshToken")?.value;

  if (!isExempt && !refreshToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const intlResponse = intlMiddleware(request);
  const response = intlResponse instanceof NextResponse ? intlResponse : NextResponse.next();

  const token = request.cookies.get("token")?.value;
  if (refreshToken && (!token || isTokenCloseToExpiry(token))) {
    const newToken = await getNewToken(refreshToken);
    if (newToken) {
      response.cookies.set("token", newToken, {
        httpOnly: false,
        path: "/",
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
      });
      response.cookies.set("reloadData", "true", {
        httpOnly: false,
        path: "/",
      });
    }
  }

  const fullUrl = request.url.replace(/^http:/, "https:");
  response.headers.set("x-full-url", fullUrl);

  return response;
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
