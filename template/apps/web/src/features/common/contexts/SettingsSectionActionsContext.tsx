"use client";

import { createContext, useContext, type ReactNode } from "react";

type SettingsSectionActionsContextType = {
  /**
   * Publish a rail section's header actions up to the shared RoundPageContainer
   * header. Keyed by the section value (the `?section=` key): the rail mounts
   * every section's content at once — inactive ones are merely hidden — so each
   * section registers under its own key and SettingsContainer renders only the
   * active section's node. Without the key, hidden siblings would clash.
   */
  register: (sectionKey: string, actions: ReactNode) => void;
};

const SettingsSectionActionsContext = createContext<SettingsSectionActionsContextType | undefined>(undefined);

export const SettingsSectionActionsProvider = SettingsSectionActionsContext.Provider;

/**
 * Returns the settings section-actions registry, or `undefined` when a section
 * component is rendered outside the settings rail (so callers can no-op safely).
 */
export const useSettingsSectionActions = (): SettingsSectionActionsContextType | undefined =>
  useContext(SettingsSectionActionsContext);
