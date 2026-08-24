"use client";

import { useSettingsSectionActions } from "@/features/common/contexts/SettingsSectionActionsContext";
import { UserContent, UserEditor } from "@carlonicora/nextjs-jsonapi/components";
import { CompanyProvider, UserProvider, useCurrentUserContext, useUserContext } from "@carlonicora/nextjs-jsonapi/contexts";
import { UserInterface, UserService } from "@carlonicora/nextjs-jsonapi/core";
import { useEffect, useState } from "react";

/** Rail `?section=` value for the "My Profile" settings tab. */
export const PROFILE_SECTION = "profile";

/**
 * The rail mounts this section as tab *content* — a descendant of the shared
 * RoundPageContainer header — so UserProvider's own `title.functions` cannot
 * reach it. Republish the edit button through the settings section-actions
 * registry, keyed by the profile section. No-ops outside the rail.
 */
function UserProfileHeaderActions() {
  const { user, setUser } = useUserContext();
  const sectionActions = useSettingsSectionActions();

  useEffect(() => {
    if (!sectionActions) return;
    sectionActions.register(PROFILE_SECTION, user ? <UserEditor user={user} propagateChanges={setUser} /> : undefined);
  }, [user, setUser, sectionActions]);

  return null;
}

function UserProfileBody() {
  const { user } = useUserContext();
  if (!user) return null;
  return <UserContent user={user} />;
}

/**
 * Settings-rail "My Profile" section: the current user's own detail content,
 * without the RoundPageContainer chrome. Mirrors the provider nesting of
 * `/users/[id]` (CompanyProvider → UserProvider) so UserEditor works.
 *
 * It renders `UserContent` directly rather than the package's `UserContainer`,
 * which wraps itself in its own RoundPageContainer — inside the rail that would
 * nest a second header, breadcrumb bar and title row on top of this page's own.
 *
 * The user is fetched from the API rather than seeded from `currentUser`, which
 * is a dehydrated blob persisted to localStorage by CurrentUserContext. That
 * blob is an identity/permissions cache and goes stale as soon as any editable
 * profile field changes, so reading it here would show pre-edit values that
 * survive a refresh.
 */
export default function UserProfileContainer() {
  const { currentUser } = useCurrentUserContext();
  const [user, setUser] = useState<UserInterface | undefined>(undefined);

  useEffect(() => {
    if (!currentUser?.id) return;
    let cancelled = false;
    UserService.findById({ userId: currentUser.id }).then((fetched) => {
      if (!cancelled) setUser(fetched as UserInterface);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  if (!user) return null;

  return (
    <CompanyProvider dehydratedCompany={user.company?.dehydrate()}>
      <UserProvider dehydratedUser={user.dehydrate()}>
        <UserProfileHeaderActions />
        <UserProfileBody />
      </UserProvider>
    </CompanyProvider>
  );
}
