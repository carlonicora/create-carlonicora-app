"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  OAuthClientForm,
  OAuthClientSecretDisplay,
  PageContainer,
  Button,
} from "@carlonicora/nextjs-jsonapi/components";
import { useOAuthClients } from "@carlonicora/nextjs-jsonapi/client";
import { OAuthClientCreateRequest } from "@carlonicora/nextjs-jsonapi/core";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";

export default function OAuthNewClientPage() {
  const t = useTranslations();
  const router = useRouter();
  const { createClient } = useOAuthClients();
  const [isLoading, setIsLoading] = useState(false);
  const [newClientSecret, setNewClientSecret] = useState<{ clientId: string; secret: string } | null>(null);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (data: OAuthClientCreateRequest) => {
      setIsLoading(true);
      try {
        const result = await createClient(data);

        // Store secret for display
        if (result.clientSecret) {
          setNewClientSecret({
            clientId: result.client.clientId,
            secret: result.clientSecret,
          });
          setCreatedClientId(result.client.id || result.client.clientId);
        } else {
          // No secret (shouldn't happen for new clients)
          router.push(`/settings/oauth/${result.client.id || result.client.clientId}`);
        }
      } catch (err) {
        console.error("Failed to create client:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [createClient, router]
  );

  const handleCancel = useCallback(() => {
    router.push("/settings/oauth");
  }, [router]);

  const handleSecretDismiss = useCallback(() => {
    setNewClientSecret(null);
    if (createdClientId) {
      router.push(`/settings/oauth/${createdClientId}`);
    } else {
      router.push("/settings/oauth");
    }
  }, [router, createdClientId]);

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">{t("oauth.settings.create_title")}</h1>
        </div>

        <OAuthClientForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={isLoading}
        />
      </div>

      {/* Show Secret Dialog */}
      <OAuthClientSecretDisplay
        secret={newClientSecret?.secret || ""}
        open={!!newClientSecret}
        onDismiss={handleSecretDismiss}
      />
    </PageContainer>
  );
}
