"use client";

import OAuthClientListContainer from "@/features/common/components/containers/OAuthClientListContainer";
import { PageContainer } from "@carlonicora/nextjs-jsonapi/components";

/**
 * Standalone `/settings/oauth` list page.
 *
 * The list body lives in `OAuthClientListContainer`, which the settings rail
 * also mounts as its Developer section — keeping it in one component means the
 * two surfaces cannot drift.
 */
export default function OAuthSettingsPage() {
  return (
    <PageContainer>
      <OAuthClientListContainer />
    </PageContainer>
  );
}
