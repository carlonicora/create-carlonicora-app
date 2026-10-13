import { ServerSession } from "@carlonicora/nextjs-jsonapi/server";
import { getPathname } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import { OAuthAuthorizeClient } from "./OAuthAuthorizeClient";

/**
 * OAuth Authorization Page
 *
 * Displays the consent screen for OAuth authorization requests.
 * If the user is not logged in, redirects to login page with callback URL.
 *
 * Expected query parameters:
 * - client_id: The OAuth client ID
 * - redirect_uri: The redirect URI after authorization
 * - scope: Space-separated list of requested scopes
 * - state: CSRF protection state parameter (optional)
 * - response_type: Must be "code" for authorization code flow
 * - code_challenge: PKCE code challenge (optional, for public clients)
 * - code_challenge_method: PKCE method, must be "S256" (optional)
 */
export default async function OAuthAuthorizePage(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await props.params;
  const searchParams = await props.searchParams;

  // Check if user is logged in
  const isLoggedIn = await ServerSession.isLogged();

  if (!isLoggedIn) {
    // Build the current URL to redirect back after login, carrying the whole
    // incoming query string. Next.js hands a repeated key over as an array.
    // Paths come from getPathname, never a hand-built `/${locale}/...`: with
    // localePrefix "as-needed" the proxy redirects `/en/x` to `/x`, and the login
    // form's client navigation to the callback cannot cross that redirect.
    const currentUrl = new URL(getPathname({ href: "/oauth/authorize", locale }), "http://localhost");
    for (const [key, value] of Object.entries(searchParams as Record<string, string | string[] | undefined>)) {
      if (value === undefined) continue;
      for (const item of Array.isArray(value) ? value : [value]) currentUrl.searchParams.append(key, item);
    }

    // Redirect to login with callback URL
    const callbackUrl = encodeURIComponent(currentUrl.pathname + currentUrl.search);
    redirect(`${getPathname({ href: "/login", locale })}?callbackUrl=${callbackUrl}`);
  }

  return (
    <OAuthAuthorizeClient
      clientId={searchParams.client_id || ""}
      redirectUri={searchParams.redirect_uri || ""}
      scope={searchParams.scope || ""}
      state={searchParams.state}
      codeChallenge={searchParams.code_challenge}
      codeChallengeMethod={searchParams.code_challenge_method as "S256" | undefined}
    />
  );
}
