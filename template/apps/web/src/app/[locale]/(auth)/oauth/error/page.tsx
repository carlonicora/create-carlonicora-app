"use client";

import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Home, UserPlus } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
} from "@carlonicora/nextjs-jsonapi/components";
import Link from "next/link";
import { useTranslations } from "next-intl";

/**
 * OAuth error codes that have specific translations
 */
const KNOWN_ERROR_CODES = [
  "access_denied",
  "invalid_request",
  "unauthorized_client",
  "unsupported_response_type",
  "invalid_scope",
  "server_error",
  "temporarily_unavailable",
  "waitlist_required",
  "registration_closed",
  "registration_disabled",
] as const;

/**
 * OAuth Error Page
 *
 * Displays OAuth authorization errors to the user.
 *
 * Query parameters:
 * - error: OAuth error code (e.g., "access_denied", "invalid_request")
 * - error_description: Human-readable error description (optional)
 * - state: State parameter from the original request (optional)
 */
export default function OAuthErrorPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error") || "unknown";
  const errorDescription = searchParams.get("error_description");

  const isKnownError = KNOWN_ERROR_CODES.includes(errorCode as typeof KNOWN_ERROR_CODES[number]);
  const errorKey = isKnownError ? errorCode : "default";

  const title = t(`oauth.errors.${errorKey}.title`);
  const description = errorDescription || t(`oauth.errors.${errorKey}.description`);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorCode !== "access_denied" && (
            <div className="rounded-lg bg-muted/50 p-4 text-sm">
              <p className="font-mono text-xs text-muted-foreground">
                {t("oauth.errors.error_code", { code: errorCode })}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {errorCode === "waitlist_required" && (
              <Button nativeButton={false} render={<Link href="/waitlist" />}>
                <UserPlus className="h-4 w-4 mr-2" />
                {t("waitlist.buttons.join")}
              </Button>
            )}
            <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
              <Home className="h-4 w-4 mr-2" />
              {t("ui.buttons.return_to_home")}
            </Button>
            <Button variant="ghost" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("ui.buttons.go_back")}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            {t("oauth.errors.contact_support")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
