import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useSubscriptionStatus: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("@carlonicora/nextjs-jsonapi/client", () => ({
  useSubscriptionStatus: mocks.useSubscriptionStatus,
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/features/common/components/skeletons/PageSkeleton", () => ({
  PageSkeleton: () => <div data-testid="page-skeleton" />,
}));

import { TrialBlockingWrapper } from "../TrialBlockingWrapper";

describe("TrialBlockingWrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the overlay until the status is known and redirects when blocked", async () => {
    mocks.useSubscriptionStatus.mockReturnValue({ status: "loading", isBlocked: false });
    const { rerender } = render(
      <TrialBlockingWrapper>
        <p>child</p>
      </TrialBlockingWrapper>,
    );

    expect(screen.getByText("child")).toBeInTheDocument();
    expect(screen.getByTestId("trial-overlay")).toBeInTheDocument();
    // Scoped to its column, so the frame skeletons around it stay visible.
    expect(screen.getByTestId("trial-overlay").className).toContain("absolute");
    expect(screen.getByTestId("trial-overlay").className).not.toContain("fixed");
    expect(mocks.replace).not.toHaveBeenCalled();

    mocks.useSubscriptionStatus.mockReturnValue({ status: "expired", isBlocked: true });
    rerender(
      <TrialBlockingWrapper>
        <p>child</p>
      </TrialBlockingWrapper>,
    );

    expect(screen.getByTestId("trial-overlay")).toBeInTheDocument();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/trial-expired"));
  });

  it("removes the overlay for an active subscription", () => {
    mocks.useSubscriptionStatus.mockReturnValue({ status: "active", isBlocked: false });
    render(
      <TrialBlockingWrapper>
        <p>child</p>
      </TrialBlockingWrapper>,
    );

    expect(screen.getByText("child")).toBeInTheDocument();
    expect(screen.queryByTestId("trial-overlay")).not.toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
