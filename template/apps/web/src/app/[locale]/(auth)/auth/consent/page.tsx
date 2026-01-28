"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  GdprConsentSection,
} from "@carlonicora/nextjs-jsonapi/components";
import { AuthService } from "@carlonicora/nextjs-jsonapi/core";
import { useTranslations } from "next-intl";

export default function ConsentPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pendingId = searchParams.get("pending");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const formSchema = z.object({
    termsAccepted: z.literal(true, {
      message: t("auth.gdpr.terms_required"),
    }),
    marketingConsent: z.boolean().optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      termsAccepted: false as unknown as true,
      marketingConsent: false,
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!pendingId) {
      setError("Missing pending registration ID");
      return;
    }

    setSubmitting(true);
    try {
      const result = await AuthService.completeOAuthRegistration({
        pendingId,
        termsAcceptedAt: new Date().toISOString(),
        marketingConsent: values.marketingConsent ?? false,
        marketingConsentAt: values.marketingConsent ? new Date().toISOString() : null,
      });

      router.push(`/auth?code=${result.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to complete registration");
      setSubmitting(false);
    }
  };

  if (!pendingId) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-destructive">{t("common.errors.error")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{t("oauth.errors.invalid_request.description")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-primary flex flex-col items-center pb-4 text-2xl">
          <Image src="/logo.webp" alt="Logo" width={80} height={80} priority />
          {t("auth.gdpr.consent_page_title")}
        </CardTitle>
        <CardDescription className="text-center">
          {t("auth.gdpr.consent_page_description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md">
            <p className="text-sm">{error}</p>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <GdprConsentSection form={form} />
            <Button
              type="submit"
              className="w-full mt-4"
              disabled={submitting}
            >
              {submitting ? t("ui.buttons.processing") : t("auth.gdpr.complete_registration")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
