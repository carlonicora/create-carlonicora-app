import { ServerSession } from "@carlonicora/nextjs-jsonapi/server";
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
    // Build the current URL to redirect back after login
    const currentUrl = new URL(`/${locale}/oauth/authorize`, "http://localhost");
    if (searchParams.client_id) currentUrl.searchParams.set("client_id", searchParams.client_id);
    if (searchParams.redirect_uri) currentUrl.searchParams.set("redirect_uri", searchParams.redirect_uri);
    if (searchParams.scope) currentUrl.searchParams.set("scope", searchParams.scope);
    if (searchParams.state) currentUrl.searchParams.set("state", searchParams.state);
    if (searchParams.code_challenge) currentUrl.searchParams.set("code_challenge", searchParams.code_challenge);
    if (searchParams.code_challenge_method)
      currentUrl.searchParams.set("code_challenge_method", searchParams.code_challenge_method);

    // Redirect to login with callback URL
    const callbackUrl = encodeURIComponent(currentUrl.pathname + currentUrl.search);
    redirect(`/${locale}/login?callbackUrl=${callbackUrl}`);
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
