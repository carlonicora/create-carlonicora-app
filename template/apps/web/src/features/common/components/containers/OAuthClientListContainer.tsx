"use client";

import { useOAuthClients } from "@carlonicora/nextjs-jsonapi/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  OAuthClientList,
  OAuthClientSecretDisplay,
} from "@carlonicora/nextjs-jsonapi/components";
import { OAuthClientInterface, OAuthService } from "@carlonicora/nextjs-jsonapi/core";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

/**
 * The OAuth client list, without page chrome.
 *
 * Mounted twice: as the settings rail's Developer section (tab *content*, a
 * descendant of the rail's shared header) and as the body of
 * `/settings/oauth`. It therefore renders no RoundPageContainer and no title of
 * its own — inside the rail that would nest a second header, breadcrumb bar and
 * title row on top of the settings pane's own.
 *
 * Navigation targets are absolute `/settings/oauth...` paths: the detail and
 * create routes live in the `(foundations)` route group, and route groups do
 * not appear in URLs.
 */
export default function OAuthClientListContainer() {
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
    [router],
  );

  const handleCreateClick = useCallback(() => {
    router.push(`/settings/oauth/new`);
  }, [router]);

  const handleEditClick = useCallback(
    (client: OAuthClientInterface) => {
      router.push(`/settings/oauth/${client.id || client.clientId}?edit=true`);
    },
    [router],
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
    <>
      <OAuthClientList
        clients={clients}
        isLoading={isLoading}
        error={error}
        onClientClick={handleClientClick}
        onCreateClick={handleCreateClick}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
        title={t(`common.oauth_applications`)}
      />

      <OAuthClientSecretDisplay
        secret={newClientSecret?.secret || ""}
        open={!!newClientSecret}
        onDismiss={handleSecretDismiss}
      />

      <AlertDialog open={!!deleteClient} onOpenChange={(open) => !open && setDeleteClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(`oauth.settings.delete_title`)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(`oauth.settings.delete_description`, { name: deleteClient?.name || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t(`ui.buttons.cancel`)}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t(`ui.buttons.deleting`) : t(`ui.buttons.delete`)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
