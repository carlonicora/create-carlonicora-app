"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@carlonicora/nextjs-jsonapi/components";
import { Check, CheckCircle, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

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
  const t = useTranslations();
  const searchParams = useSearchParams();
  const code = searchParams.get("code") || "";
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      // Try modern clipboard API first (requires secure context)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        // Fallback for non-secure contexts (http://*.test, etc.)
        const textArea = document.createElement("textarea");
        textArea.value = code;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [code]);

  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="text-2xl">{t("oauth.success.title")}</CardTitle>
          <CardDescription>{t("oauth.success.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">{t("oauth.success.code_label")}</Label>
            <div className="flex gap-2">
              <Input id="code" value={code} readOnly className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={handleCopy} title="Copy to clipboard">
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="bg-muted/50 text-muted-foreground rounded-lg p-4 text-sm">
            <p className="mb-2 font-medium">{t("oauth.success.instructions")}</p>
            <ol className="list-inside list-decimal space-y-1">
              <li>{t("oauth.success.step_copy")}</li>
              <li>{t("oauth.success.step_return")}</li>
              <li>{t("oauth.success.step_paste")}</li>
            </ol>
          </div>

          <p className="text-muted-foreground text-center text-xs">{t("oauth.success.expiry_note")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
