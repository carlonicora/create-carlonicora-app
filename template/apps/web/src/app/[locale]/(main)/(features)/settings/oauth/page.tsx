"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  OAuthClientList,
  OAuthClientSecretDisplay,
  PageContainer,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@carlonicora/nextjs-jsonapi/components";
import { useOAuthClients } from "@carlonicora/nextjs-jsonapi/client";
import { OAuthClientInterface, OAuthService } from "@carlonicora/nextjs-jsonapi/core";
import { useTranslations } from "next-intl";

export default function OAuthSettingsPage() {
  const t = useTranslations();
  const router = useRouter();
  const { clients, isLoading, error, refetch } = useOAuthClients();
  const [newClientSecret, setNewClientSecret] = useState<{ clientId: string; secret: string } | null>(null);
  const [deleteClient, setDeleteClient] = useState<OAuthClientInterface | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClientClick = useCallback(
    (client: OAuthClientInterface) => {
      router.push(`/settings/oauth/${client.id || client.clientId}`);
    },
    [router]
  );

  const handleCreateClick = useCallback(() => {
    router.push("/settings/oauth/new");
  }, [router]);

  const handleEditClick = useCallback(
    (client: OAuthClientInterface) => {
      router.push(`/settings/oauth/${client.id || client.clientId}?edit=true`);
    },
    [router]
  );

  const handleDeleteClick = useCallback((client: OAuthClientInterface) => {
    setDeleteClient(client);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteClient) return;

    setIsDeleting(true);
    try {
      await OAuthService.deleteClient({ clientId: deleteClient.clientId });
      await refetch();
      setDeleteClient(null);
    } catch (err) {
      console.error("Failed to delete client:", err);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteClient, refetch]);

  const handleSecretDismiss = useCallback(() => {
    setNewClientSecret(null);
  }, []);

  return (
    <PageContainer>
      <OAuthClientList
        clients={clients}
        isLoading={isLoading}
        error={error}
        onClientClick={handleClientClick}
        onCreateClick={handleCreateClick}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
        title="OAuth Applications"
        emptyStateMessage="Create OAuth applications to allow third-party integrations."
      />

      {/* New Client Secret Display */}
      <OAuthClientSecretDisplay
        secret={newClientSecret?.secret || ""}
        open={!!newClientSecret}
        onDismiss={handleSecretDismiss}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteClient} onOpenChange={(open) => !open && setDeleteClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("oauth.settings.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("oauth.settings.delete_description", { name: deleteClient?.name || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("ui.buttons.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t("ui.buttons.deleting") : t("ui.buttons.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
