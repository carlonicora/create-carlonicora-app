import { ENV } from "@/config/middleware-env";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

async function getNewToken(refreshToken: string): Promise<string | null> {
  try {
    const headers: HeadersInit = {};
    const options: RequestInit = { method: "POST", headers: headers };
    const uri = `${process.env.NEXT_PUBLIC_API_URL}auth/refreshtoken/${refreshToken}`;
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

  if (pathname === "/githubconnects/callback") {
    const code = searchParams.get("code");
    const installation_id = searchParams.get("installation_id");
    const setup_action = searchParams.get("setup_action");
    const state = searchParams.get("state");

    let path = null;
    if (state && state.startsWith("{{name}}")) {
      path = decodeURIComponent(state.substring(5));
    }

    const nextPublicAddress = ENV.APP_URL;
    if (state && path && !nextPublicAddress.includes(path)) {
      const redirectUrl = `${path}?code=${encodeURIComponent(code || "")}&installation_id=${encodeURIComponent(installation_id || "")}&setup_action=${encodeURIComponent(setup_action || "")}`;
      return NextResponse.redirect(redirectUrl);
    }
  }

  const normalizedPathname = pathname.replace(/^\/([a-z]{2})(?=\/)/, "");

  const exemptPaths = ["/", "/activation", "/auth", "/invitation", "/login", "/logout", "/register", "/reset"];
  const isExempt = exemptPaths.some((path) => normalizedPathname.startsWith(path));

  const refreshToken = request.cookies.get("refreshToken")?.value;

  if (!isExempt && !refreshToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const requestsSupport = normalizedPathname.startsWith("/support");
  if (
    (!process.env.NEXT_PUBLIC_PRIVATE_INSTALLATION ||
      process.env.NEXT_PUBLIC_PRIVATE_INSTALLATION.toLowerCase() !== "true") &&
    requestsSupport
  ) {
    return NextResponse.redirect(new URL("/", request.url));
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
