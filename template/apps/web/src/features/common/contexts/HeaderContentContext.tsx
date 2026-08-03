"use client";

import { createContext, ReactNode, useContext } from "react";

interface HeaderContentContextType {
  headerContent: ReactNode | null;
}

const HeaderContentContext = createContext<HeaderContentContextType>({
  headerContent: null,
});

interface HeaderContentProviderProps {
  children: ReactNode;
  content: ReactNode;
}

export function HeaderContentProvider({ children, content }: HeaderContentProviderProps) {
  return <HeaderContentContext.Provider value={{ headerContent: content }}>{children}</HeaderContentContext.Provider>;
}

export function useHeaderContent(): ReactNode | null {
  const context = useContext(HeaderContentContext);
  return context.headerContent;
}
