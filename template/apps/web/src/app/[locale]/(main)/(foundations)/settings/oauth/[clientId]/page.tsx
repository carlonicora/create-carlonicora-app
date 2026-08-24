"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, use } from "react";
import {
  OAuthClientDetail,
  OAuthClientForm,
  OAuthClientSecretDisplay,
  PageContainer,
  SectionHeader,
  Button,
  Skeleton,
} from "@carlonicora/nextjs-jsonapi/components";
import { useOAuthClient } from "@carlonicora/nextjs-jsonapi/client";
import { OAuthClientCreateRequest } from "@carlonicora/nextjs-jsonapi/core";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";

interface OAuthClientDetailPageProps {
  params: Promise<{ clientId: string }>;
}

export default function OAuthClientDetailPage({ params }: OAuthClientDetailPageProps) {
  const t = useTranslations();
  const { clientId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get("edit") === "true";

  const { client, isLoading, error, update, deleteClient, regenerateSecret } = useOAuthClient(clientId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newClientSecret, setNewClientSecret] = useState<string | null>(null);

  const handleBack = useCallback(() => {
    router.push("/settings/oauth");
  }, [router]);

  const handleEdit = useCallback(() => {
    router.push(`/settings/oauth/${clientId}?edit=true`);
  }, [router, clientId]);

  const handleCancelEdit = useCallback(() => {
    router.push(`/settings/oauth/${clientId}`);
  }, [router, clientId]);

  const handleSubmit = useCallback(
    async (data: OAuthClientCreateRequest) => {
      setIsSubmitting(true);
      try {
        await update(data);
        router.push(`/settings/oauth/${clientId}`);
      } catch (err) {
        console.error("Failed to update client:", err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [update, router, clientId]
  );

  const handleDelete = useCallback(async () => {
    try {
      await deleteClient();
      router.push("/settings/oauth");
    } catch (err) {
      console.error("Failed to delete client:", err);
    }
  }, [deleteClient, router]);

  const handleRegenerateSecret = useCallback(async () => {
    try {
      const secret = await regenerateSecret();
      setNewClientSecret(secret);
    } catch (err) {
      console.error("Failed to regenerate secret:", err);
    }
  }, [regenerateSecret]);

  const handleSecretDismiss = useCallback(() => {
    setNewClientSecret(null);
  }, []);

  // Loading state
  if (isLoading && !client) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Skeleton className="h-8 w-48" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </PageContainer>
    );
  }

  // Error state
  if (error || !client) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <SectionHeader level={2}>{t("oauth.settings.title")}</SectionHeader>
          </div>
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
            <p className="text-destructive">
              {error?.message || t("oauth.settings.failed_to_load")}
            </p>
            <Button className="mt-4" onClick={handleBack}>
              {t("oauth.settings.back_to_applications")}
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  // Edit mode
  if (isEditMode) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleCancelEdit}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <SectionHeader level={2}>{t("oauth.settings.edit_title", { name: client.name })}</SectionHeader>
          </div>

          <OAuthClientForm
            client={client}
            onSubmit={handleSubmit}
            onCancel={handleCancelEdit}
            isLoading={isSubmitting}
          />
        </div>
      </PageContainer>
    );
  }

  // Detail view
  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <SectionHeader level={2}>{client.name}</SectionHeader>
        </div>

        <OAuthClientDetail
          client={client}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onRegenerateSecret={handleRegenerateSecret}
        />
      </div>

      {/* Show Secret Dialog */}
      <OAuthClientSecretDisplay
        secret={newClientSecret || ""}
        open={!!newClientSecret}
        onDismiss={handleSecretDismiss}
      />
    </PageContainer>
  );
}
