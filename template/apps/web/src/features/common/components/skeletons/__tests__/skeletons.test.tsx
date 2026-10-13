import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@carlonicora/nextjs-jsonapi/components", () => ({
  Skeleton: ({ className }: { className?: string }) => <div data-slot="skeleton" className={className} />,
  SidebarMenuSkeleton: ({ showIcon }: { showIcon?: boolean }) => (
    <div data-sidebar="menu-skeleton">
      {showIcon && <div data-slot="skeleton" />}
      <div data-slot="skeleton" />
    </div>
  ),
}));

import { AppFrameSkeleton } from "../AppFrameSkeleton";
import { PageSkeleton } from "../PageSkeleton";
import { SidebarSkeleton } from "../SidebarSkeleton";

describe("skeletons", () => {
  it.each([
    ["PageSkeleton", PageSkeleton],
    ["SidebarSkeleton", SidebarSkeleton],
    ["AppFrameSkeleton", AppFrameSkeleton],
  ])("%s renders skeleton primitives", (_name, Component) => {
    const { container } = render(<Component />);

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("SidebarSkeleton renders eight menu rows", () => {
    const { container } = render(<SidebarSkeleton />);

    expect(container.querySelectorAll('[data-sidebar="menu-skeleton"]')).toHaveLength(8);
  });

  it("AppFrameSkeleton contains the sidebar menu rows", () => {
    const { container } = render(<AppFrameSkeleton />);

    expect(container.querySelectorAll('[data-sidebar="menu-skeleton"]').length).toBeGreaterThan(0);
  });
});
