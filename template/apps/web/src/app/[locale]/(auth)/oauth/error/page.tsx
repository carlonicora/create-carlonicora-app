"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@carlonicora/nextjs-jsonapi/components";
import { AlertTriangle, ArrowLeft, Home, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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

  const isKnownError = KNOWN_ERROR_CODES.includes(errorCode as (typeof KNOWN_ERROR_CODES)[number]);
  const errorKey = isKnownError ? errorCode : "default";

  const title = t(`oauth.errors.${errorKey}.title`);
  const description = errorDescription || t(`oauth.errors.${errorKey}.description`);

  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="bg-destructive/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <AlertTriangle className="text-destructive h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorCode !== "access_denied" && (
            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <p className="text-muted-foreground font-mono text-xs">
                {t("oauth.errors.error_code", { code: errorCode })}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {errorCode === "waitlist_required" && (
              <Button nativeButton={false} render={<Link href="/waitlist" />}>
                <UserPlus className="mr-2 h-4 w-4" />
                {t("waitlist.buttons.join")}
              </Button>
            )}
            <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
              <Home className="mr-2 h-4 w-4" />
              {t("ui.buttons.return_to_home")}
            </Button>
            <Button variant="ghost" onClick={() => window.history.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("ui.buttons.go_back")}
            </Button>
          </div>

          <p className="text-muted-foreground text-center text-xs">{t("oauth.errors.contact_support")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
