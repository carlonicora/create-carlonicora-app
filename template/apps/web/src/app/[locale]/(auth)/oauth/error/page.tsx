"use client";

import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Home } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
} from "@carlonicora/nextjs-jsonapi/components";
import Link from "next/link";

/**
 * Error code to user-friendly message mapping
 */
const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  access_denied: {
    title: "Access Denied",
    description: "You denied the authorization request.",
  },
  invalid_request: {
    title: "Invalid Request",
    description: "The authorization request is missing required parameters or is otherwise malformed.",
  },
  unauthorized_client: {
    title: "Unauthorized Client",
    description: "The client is not authorized to request an authorization code.",
  },
  unsupported_response_type: {
    title: "Unsupported Response Type",
    description: "The authorization server does not support the requested response type.",
  },
  invalid_scope: {
    title: "Invalid Scope",
    description: "The requested scope is invalid, unknown, or exceeds the authorized scope.",
  },
  server_error: {
    title: "Server Error",
    description: "An unexpected error occurred on the authorization server.",
  },
  temporarily_unavailable: {
    title: "Temporarily Unavailable",
    description: "The authorization server is currently unavailable. Please try again later.",
  },
};

const DEFAULT_ERROR = {
  title: "Authorization Error",
  description: "An error occurred during the authorization process.",
};

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
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error") || "unknown";
  const errorDescription = searchParams.get("error_description");

  const errorInfo = ERROR_MESSAGES[errorCode] || DEFAULT_ERROR;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl">{errorInfo.title}</CardTitle>
          <CardDescription>
            {errorDescription || errorInfo.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorCode !== "access_denied" && (
            <div className="rounded-lg bg-muted/50 p-4 text-sm">
              <p className="font-mono text-xs text-muted-foreground">
                Error code: {errorCode}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button variant="outline" render={<Link href="/" />}>
              <Home className="h-4 w-4 mr-2" />
              Return to Home
            </Button>
            <Button variant="ghost" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            If you continue to experience issues, please contact support.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
