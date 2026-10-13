import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const marker = (name: string) => {
    const Component = ({ children }: { children?: React.ReactNode }) => <div data-testid={name}>{children}</div>;
    Component.displayName = name;
    return Component;
  };
  return { marker };
});

vi.mock("@carlonicora/nextjs-jsonapi/contexts/styles.css", () => ({}));
vi.mock("react-horizontal-scrolling-menu/dist/styles.css", () => ({}));
vi.mock("@/features/common/components/session/AppShell", () => ({ AppShell: mocks.marker("AppShell") }));
vi.mock("@/features/common/components/skeletons/AppFrameSkeleton", () => ({
  AppFrameSkeleton: mocks.marker("AppFrameSkeleton"),
}));
vi.mock("@/features/common/components/skeletons/PageSkeleton", () => ({
  PageSkeleton: mocks.marker("PageSkeleton"),
}));

import MainLayout from "../[locale]/(main)/layout";
import MainLoading from "../[locale]/(main)/loading";
import FoundationsLoading from "../[locale]/(main)/(foundations)/loading";
import AdministrationLoading from "../[locale]/(admin)/administration/loading";

const params = Promise.resolve({ locale: "en" });

function isElementOfType(node: unknown, type: unknown): node is React.ReactElement<Record<string, any>> {
  return typeof node === "object" && node !== null && (node as React.ReactElement).type === type;
}

describe("app layouts", () => {
  it("the (main) layout renders its children inside AppShell under a Suspense whose fallback is AppFrameSkeleton", async () => {
    const tree = await MainLayout({ children: <span>page</span>, params });

    expect(isElementOfType(tree, Suspense)).toBe(true);
    const suspense = tree as React.ReactElement<{ fallback: React.ReactElement; children: React.ReactElement }>;
    expect((suspense.props.fallback.type as { displayName?: string }).displayName).toBe("AppFrameSkeleton");
    expect((suspense.props.children.type as { displayName?: string }).displayName).toBe("AppShell");

    render(tree);
    expect(screen.getByTestId("AppShell")).toHaveTextContent("page");
  });

  // Client navigations only re-render below the layout two routes share, so
  // every data-fetching segment has its own loading.tsx.
  it("every loading.tsx under the app groups renders PageSkeleton", () => {
    // Route-group names like (main) and [locale] are glob syntax, so glob broadly and filter.
    const loadings = import.meta.glob<{ default: () => React.ReactElement }>("../**/loading.tsx", { eager: true });
    const entries = Object.entries(loadings).filter(
      ([path]) => path.includes("/(main)/") || path.includes("/(admin)/"),
    );
    expect(entries.length).toBeGreaterThanOrEqual(22);
    for (const [path, mod] of entries) {
      const Loading = mod.default;
      const { unmount } = render(<Loading />);
      expect(screen.getByTestId("PageSkeleton"), path).toBeInTheDocument();
      unmount();
    }
  });

  it("every app loading.tsx renders PageSkeleton", () => {
    for (const Loading of [MainLoading, FoundationsLoading, AdministrationLoading]) {
      const { unmount } = render(<Loading />);
      expect(screen.getByTestId("PageSkeleton")).toBeInTheDocument();
      unmount();
    }
  });
});
