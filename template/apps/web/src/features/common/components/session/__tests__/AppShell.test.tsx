import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const sessionProps: Record<string, unknown> = {};
  const passthrough = (name: string) => {
    const Component = ({ children, session }: { children?: React.ReactNode; session?: unknown }) => {
      if (session !== undefined) sessionProps[name] = session;
      return <div data-testid={name}>{children}</div>;
    };
    Component.displayName = name;
    return Component;
  };
  return {
    passthrough,
    sessionProps,
    read: vi.fn(),
  };
});

vi.mock("@carlonicora/nextjs-jsonapi/server", () => ({ ServerSession: { read: mocks.read } }));
vi.mock("@carlonicora/nextjs-jsonapi/components", () => ({
  PushNotificationProvider: mocks.passthrough("PushNotificationProvider"),
  RefreshUser: mocks.passthrough("RefreshUser"),
  SidebarProvider: mocks.passthrough("SidebarProvider"),
}));
vi.mock("@carlonicora/nextjs-jsonapi/contexts", () => ({
  CurrentUserProvider: mocks.passthrough("CurrentUserProvider"),
  NotificationContextProvider: mocks.passthrough("NotificationContextProvider"),
  SessionProvider: mocks.passthrough("SessionProvider"),
  SocketProvider: mocks.passthrough("SocketProvider"),
  ViewportProvider: mocks.passthrough("ViewportProvider"),
}));
vi.mock("@/features/common/components/details/LayoutDetails", () => ({
  default: mocks.passthrough("LayoutDetails"),
}));
vi.mock("@/features/onboarding", () => ({
  OnboardingProviderWrapper: mocks.passthrough("OnboardingProviderWrapper"),
}));

import { AppShell } from "../AppShell";

describe("AppShell", () => {
  beforeEach(() => {
    mocks.read.mockReset();
    for (const key of Object.keys(mocks.sessionProps)) delete mocks.sessionProps[key];
  });

  it("renders its children synchronously while the session is pending", () => {
    mocks.read.mockReturnValue(new Promise(() => {}));

    render(<AppShell><p>page</p></AppShell>);

    expect(screen.getByText("page")).toBeInTheDocument();
    expect(screen.getByTestId("LayoutDetails")).toHaveTextContent("page");
    expect(mocks.read).toHaveBeenCalledTimes(1);
  });

  it("passes the same promise to SessionProvider, ViewportProvider, SocketProvider and SidebarProvider", () => {
    const session = new Promise(() => {});
    mocks.read.mockReturnValue(session);

    render(<AppShell><p>page</p></AppShell>);

    expect(mocks.sessionProps.SessionProvider).toBe(session);
    expect(mocks.sessionProps.ViewportProvider).toBe(session);
    expect(mocks.sessionProps.SocketProvider).toBe(session);
    expect(mocks.sessionProps.SidebarProvider).toBe(session);
  });
});
