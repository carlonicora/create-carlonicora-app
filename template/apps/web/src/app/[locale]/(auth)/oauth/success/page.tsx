"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Check, Copy, CheckCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
} from "@carlonicora/nextjs-jsonapi/components";

/**
 * OAuth Success Page
 *
 * Displays the authorization code for manual copy flow.
 * This is used when the redirect URI doesn't support automatic redirect
 * (e.g., custom schemes, localhost during development, etc.)
 *
 * Query parameters:
 * - code: The authorization code to be copied
 */
export default function OAuthSuccessPage() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") || "";
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [code]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Authorization Successful</CardTitle>
          <CardDescription>
            Copy the authorization code below and paste it into your application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Authorization Code</Label>
            <div className="flex gap-2">
              <Input
                id="code"
                value={code}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                title="Copy to clipboard"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <p className="font-medium mb-2">Instructions:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Copy the authorization code above</li>
              <li>Return to your application</li>
              <li>Paste the code when prompted</li>
            </ol>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            This code expires in 10 minutes and can only be used once.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
