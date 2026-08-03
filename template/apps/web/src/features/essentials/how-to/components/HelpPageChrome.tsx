"use client";

import { RoundPageContainer } from "@carlonicora/nextjs-jsonapi/components";
import { SharedProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import type { BreadcrumbItemData } from "@carlonicora/nextjs-jsonapi/core";
import { LifeBuoyIcon } from "lucide-react";
import { ReactNode } from "react";
import { HelpHeaderActions } from "./HelpHeaderActions";

export function HelpPageChrome({
  titleType,
  titleElement,
  breadcrumbs,
  details,
  children,
}: {
  titleType: string;
  titleElement?: string;
  breadcrumbs: BreadcrumbItemData[];
  details?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SharedProvider
      value={{
        breadcrumbs,
        title: {
          type: titleType,
          element: titleElement,
          icon: <LifeBuoyIcon className="text-primary h-6 w-6" />,
          functions: <HelpHeaderActions />,
        },
      }}
    >
      <RoundPageContainer details={details}>{children}</RoundPageContainer>
    </SharedProvider>
  );
}
