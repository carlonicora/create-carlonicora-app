"use client";

import { OAuthConsentScreen } from "@carlonicora/nextjs-jsonapi/components";

interface OAuthAuthorizeClientProps {
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: "S256";
}

export function OAuthAuthorizeClient({
  clientId,
  redirectUri,
  scope,
  state,
  codeChallenge,
  codeChallengeMethod,
}: OAuthAuthorizeClientProps) {
  return (
    <OAuthConsentScreen
      params={{
        clientId,
        redirectUri,
        scope,
        state,
        codeChallenge,
        codeChallengeMethod,
      }}
      appName="{{name}}"
      termsUrl="/terms"
      privacyUrl="/privacy"
    />
  );
}
