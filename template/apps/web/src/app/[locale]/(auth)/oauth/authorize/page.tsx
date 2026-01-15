"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { OAuthConsentScreen } from "@carlonicora/nextjs-jsonapi/components";

/**
 * OAuth Authorization Page
 *
 * Displays the consent screen for OAuth authorization requests.
 * Expects the following query parameters:
 * - client_id: The OAuth client ID
 * - redirect_uri: The redirect URI after authorization
 * - scope: Space-separated list of requested scopes
 * - state: CSRF protection state parameter (optional)
 * - response_type: Must be "code" for authorization code flow
 * - code_challenge: PKCE code challenge (optional, for public clients)
 * - code_challenge_method: PKCE method, must be "S256" (optional)
 */
export default function OAuthAuthorizePage() {
  const searchParams = useSearchParams();

  const params = useMemo(
    () => ({
      clientId: searchParams.get("client_id") || "",
      redirectUri: searchParams.get("redirect_uri") || "",
      scope: searchParams.get("scope") || "",
      state: searchParams.get("state") || undefined,
      codeChallenge: searchParams.get("code_challenge") || undefined,
      codeChallengeMethod: (searchParams.get("code_challenge_method") as "S256") || undefined,
    }),
    [searchParams]
  );

  return (
    <OAuthConsentScreen
      params={params}
      appName="{{name}}"
      termsUrl="/terms"
      privacyUrl="/privacy"
    />
  );
}
