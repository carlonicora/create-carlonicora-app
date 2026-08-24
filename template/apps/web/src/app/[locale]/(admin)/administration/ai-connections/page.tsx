import { generateSpecificMetadata } from "@/utils/metadata";
// Client subpath, NOT /core: the container is a client component, and the
// package only stamps "use client" on the entries listed in tsup's
// clientEntries. Reaching it through a directive-less barrel makes Next treat it
// as a Server Component and every createContext in its graph fails to compile —
// the same trap documented on the token-usage route.
import { AiConnectionsContainer } from "@carlonicora/nextjs-jsonapi/components";
import { AdministrationProvider } from "@carlonicora/nextjs-jsonapi/contexts";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();

  return await generateSpecificMetadata({ title: t(`ai_connections.admin.title`) });
}

/**
 * Administrative editor for the AI connection fallback chains.
 *
 * The (admin) layout already returns 403 for anyone without the Administrator
 * role, so this route carries no auth code of its own.
 *
 * The route is deliberately thin: `AiConnectionsContainer` mounts its own
 * `AiConnectionsProvider` (which publishes the page chrome) and its own
 * `RoundPageContainer module={Modules.AiConnection}`, the same shape as
 * ProductsListContainer. Wrapping it in a second shell here would double the
 * title bar and the context. `Modules.AiConnection` is passed inside the
 * container because a registry entry carries an icon component and a model
 * class, which a Server Component cannot send across the client boundary.
 *
 * `AdministrationProvider` stays: the header breadcrumb and title bar read
 * `useSharedContext()` from far up the tree (see AdministrationContext.tsx).
 */
export default async function AdministrationAiConnectionsPage() {
  return (
    <AdministrationProvider>
      <AiConnectionsContainer />
    </AdministrationProvider>
  );
}
