import { smokeTest, type SmokeRoute } from "../support/smoke";

/**
 * Every route under the (admin) group, as the platform administrator. The
 * layout gate is proved elsewhere (app.smoke.spec.ts); this file proves that
 * each page still renders, makes no failing same-stack request and throws
 * nothing in the browser.
 *
 * `ready` anchors on the admin shell's sidebar for pages whose content is a
 * library container without a stable testid, and on something page-specific
 * wherever one exists. Prefer the latter when you add a route.
 */
const sidebar: SmokeRoute["ready"] = (page) => page.getByTestId("sidebar-container");

const routes: SmokeRoute[] = [
  { path: "/administration", ready: (page) => page.getByTestId("admin-index-companies") },
  { path: "/administration/users", ready: (page) => page.getByTestId("content-table-search-trigger") },
  { path: "/administration/companies", ready: sidebar },
  { path: "/administration/rbac", ready: sidebar },
  { path: "/administration/products", ready: sidebar },
  // No /administration/prices index route exists in the template (only prices/[id]);
  // it 404s by design, so it is not smoked.
  { path: "/administration/ai-connections", ready: sidebar },
  { path: "/administration/token-usage", ready: sidebar },
  { path: "/administration/howtos", ready: sidebar },
  { path: "/administration/waitlist", ready: sidebar },
];

for (const route of routes) smokeTest(route);
