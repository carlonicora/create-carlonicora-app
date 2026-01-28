import { OnboardingStepConfig } from "@carlonicora/nextjs-jsonapi/contexts";

// Helper to create tab click actions
// Simulates a real mouse click with coordinates for Radix UI
export const clickElement = (selector: string) => () => {
  const element = document.querySelector(selector) as HTMLElement | null;
  if (element) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const mousedownEvent = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: centerX,
      clientY: centerY,
    });
    const mouseupEvent = new MouseEvent("mouseup", {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: centerX,
      clientY: centerY,
    });
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: centerX,
      clientY: centerY,
    });

    element.dispatchEvent(mousedownEvent);
    element.dispatchEvent(mouseupEvent);
    element.dispatchEvent(clickEvent);
  }
};

// Tour IDs constant - Add your tour IDs here
export const TOURS = {
  // Example:
  // DASHBOARD: "dashboard",
  // SETTINGS: "settings",
} as const;

// Tour paths mapping - Map URLs to tour IDs
// Use dynamic segments with :id syntax for detail pages
export const TOUR_PATHS: Record<string, string> = {
  // Example:
  // "/": TOURS.DASHBOARD,
  // "/settings": TOURS.SETTINGS,
  // "/users/:id": TOURS.USER_DETAIL,
};

// Tour steps record - Map tour IDs to step configurations
const TOUR_STEPS: Record<string, OnboardingStepConfig[]> = {
  // Example:
  // [TOURS.DASHBOARD]: [
  //   {
  //     target: "#sidebar-nav",
  //     title: "Navigation",
  //     description: "Use the sidebar to navigate between sections",
  //     placement: "right",
  //   },
  // ],
};

// Get tour steps by tour name
export function getTourSteps(tourName: string): OnboardingStepConfig[] {
  return TOUR_STEPS[tourName] || [];
}

// Helper: Match dynamic path segments (:id syntax)
function matchDynamicPath(pathname: string, pattern: string): boolean {
  const pathSegments = pathname.split("/").filter(Boolean);
  const patternSegments = pattern.split("/").filter(Boolean);

  if (pathSegments.length !== patternSegments.length) {
    return false;
  }

  return patternSegments.every((patternSeg, index) => {
    if (patternSeg.startsWith(":")) return true;
    return patternSeg === pathSegments[index];
  });
}

// Get tour for current path
export function getTourForPath(pathname: string): string | null {
  // Remove locale prefix (e.g., /en, /it)
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?:\/|$)/, "/");

  // Priority 1: Exact match
  if (TOUR_PATHS[pathWithoutLocale]) {
    return TOUR_PATHS[pathWithoutLocale];
  }

  // Priority 2: Dynamic segment match
  let bestMatch: { tour: string; staticCount: number } | null = null;

  for (const [pattern, tour] of Object.entries(TOUR_PATHS)) {
    if (!pattern.includes(":")) continue;

    if (matchDynamicPath(pathWithoutLocale, pattern)) {
      const staticCount = pattern.split("/").filter((seg) => !seg.startsWith(":") && seg).length;
      if (!bestMatch || staticCount > bestMatch.staticCount) {
        bestMatch = { tour, staticCount };
      }
    }
  }

  return bestMatch?.tour ?? null;
}
