import { hasLocale } from "next-intl";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { ENV } from "@/config/middleware-env";

const intlMiddleware = createMiddleware(routing);

/**
 * Paths a visitor without a session may reach. Mirrors the route groups under
 * app/[locale]: keep it in step when a group gains a top-level segment.
 */
export const PUBLIC_PATHS = [
  // Landing: `/` is rewritten to `/home` for visitors without a session.
  "/",
  "/home",
  // (auth)
  "/activation",
  "/auth",
  "/invitation",
  "/login",
  "/logout",
  // The API sends a visitor who is not logged in to /oauth/error after a
  // refused social login (registration_closed, waitlist_required, ...);
  // /oauth/authorize guards itself and /oauth/success only echoes a query parameter.
  "/oauth",
  "/register",
  "/reset",
  // (public-help): deliberately unauthenticated
  "/help",
  // Precached PWA fallback. MUST stay exempt: the service worker fetches it
  // unauthenticated at install time, and an auth redirect would be cached in
  // its place.
  "/offline",
] as const;

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

/** `/` matches exactly; every other entry matches itself and anything below it. */
export function isPublicPath(normalizedPathname: string): boolean {
  return PUBLIC_PATHS.some((p) =>
    p === "/" ? normalizedPathname === "/" : normalizedPathname === p || normalizedPathname.startsWith(p + "/"),
  );
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

function buildLoginRedirect(request: NextRequest): URL {
  const loginUrl = new URL(`/login`, request.url);
  const returnUrl = request.nextUrl.pathname + request.nextUrl.search;
  // The param is named `callbackUrl` because that is the name the shared
  // package's Login/TwoFactorChallenge forms already read on success. Emitting
  // `returnUrl` instead would preserve nothing — nothing consumes it.
  if (returnUrl !== "/") loginUrl.searchParams.set("callbackUrl", returnUrl);
  return loginUrl;
}

// A clean visitor carries neither cookie; skipping the delete keeps Set-Cookie off their response.
function clearSessionCookies(request: NextRequest, response: NextResponse): void {
  if (!request.cookies.has("token") && !request.cookies.has("refreshToken")) return;
  response.cookies.delete("token");
  response.cookies.delete("refreshToken");
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const normalizedPathname = stripLocalePrefix(pathname);
  const locale = normalizedPathname === pathname ? undefined : pathname.slice(1).split("/")[0];
  const isPublic = isPublicPath(normalizedPathname);

  const refreshToken = request.cookies.get("refreshToken")?.value;
  const token = request.cookies.get("token")?.value;

  // Refresh first, so every decision below sees the real session state.
  let newToken: string | null = null;
  let refreshFailed = false;
  if (refreshToken && (!token || isTokenCloseToExpiry(token))) {
    newToken = await getNewToken(refreshToken);
    refreshFailed = !newToken;
  }
  const hasSession = !!refreshToken && !refreshFailed;

  if (!hasSession && !isPublic) {
    const redirectResponse = NextResponse.redirect(buildLoginRedirect(request));
    clearSessionCookies(request, redirectResponse);
    return redirectResponse;
  }

  const intlResponse = intlMiddleware(request);
  let response = intlResponse instanceof NextResponse ? intlResponse : NextResponse.next();

  if (!hasSession) {
    // Logged-out visitors on `/` get the static landing; the URL stays `/`.
    // The rewrite sits on top of the intl response so its locale handling is kept.
    const isIntlRedirect = response.headers.has("location");
    if (normalizedPathname === "/" && !isIntlRedirect) {
      const intlRewrite = response.headers.get("x-middleware-rewrite");
      const base = intlRewrite
        ? new URL(intlRewrite).pathname.replace(/\/$/, "")
        : locale
          ? `/${locale}`
          : "";
      const target = new URL(`${base}/home`, request.url);
      target.search = request.nextUrl.search;
      response = NextResponse.rewrite(target, { headers: response.headers });
    }
    clearSessionCookies(request, response);
  } else if (newToken) {
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

  const fullUrl = request.url.replace(/^http:/, "https:");
  response.headers.set("x-full-url", fullUrl);

  return response;
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
