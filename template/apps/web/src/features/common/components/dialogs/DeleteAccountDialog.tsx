"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useCurrentUserContext } from "@carlonicora/nextjs-jsonapi/contexts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@carlonicora/nextjs-jsonapi/components";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const t = useTranslations("subscription");
  const { company } = useCurrentUserContext();
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const canDelete = confirmation === company?.name;

  const handleDelete = async () => {
    if (!canDelete || !company) return;

    setIsDeleting(true);
    try {
      await fetch(`/api/companies/${company.id}/self-delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      window.location.href = "/";
    } catch (error) {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("delete_confirmation_title")}</DialogTitle>
          <DialogDescription>{t("delete_confirmation_description")}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-muted-foreground mb-2 text-sm">
            {t("delete_confirmation_prompt", { companyName: company?.name })}
          </p>
          <Input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder={company?.name}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" disabled={!canDelete || isDeleting} onClick={handleDelete}>
            {t("delete_button")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
