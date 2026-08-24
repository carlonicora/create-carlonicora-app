import path from "node:path";
import dotenv from "dotenv";

// The suite talks to the same Neo4j server the app does, so the connection
// details come from the repo-root `.env` — the single place they are declared.
// `.env.e2e` is layered on top for anything a developer overrode locally;
// dotenv never overwrites an already-set variable, and scripts/e2e.sh exports
// the e2e values before Playwright starts, so the precedence is:
//   runner-exported env  >  .env.e2e  >  .env  >  the defaults below.
const repoRoot = path.resolve(__dirname, "..", "..", "..");
dotenv.config({ path: path.join(repoRoot, ".env.e2e") });
dotenv.config({ path: path.join(repoRoot, ".env") });

const apiPort = Number(process.env.E2E_API_PORT ?? 3980);
const webPort = Number(process.env.E2E_WEB_PORT ?? 3981);
const webHost = process.env.E2E_PUBLIC_HOSTNAME ?? process.env.PUBLIC_HOSTNAME ?? "{{name}}.test";
const apiHost = `api.${webHost}`;

export const E2E = {
  apiPort,
  webPort,
  workerHealthPort: Number(process.env.E2E_WORKER_HEALTH_PORT ?? 3982),
  apiBase: `http://${apiHost}:${apiPort}`,
  webBase: `http://${webHost}:${webPort}`,
  // The SAME web server, reached as the literal "localhost" — which Chromium
  // treats as a secure context, unlike a custom /etc/hosts name over plain
  // http. Anything that needs `navigator.serviceWorker`, `crypto.subtle` or a
  // Secure cookie has to be driven through this origin. Cookies are
  // domain-scoped, so a storageState saved for the custom host does not
  // authenticate this one — save a second state with cookieDomain "localhost".
  webBaseLocalhost: `http://localhost:${webPort}`,
  // The cookie domain that goes with `webBase`.
  cookieDomain: webHost,
  neo4j: {
    uri: process.env.NEO4J_URI ?? "bolt://localhost:7687",
    user: process.env.NEO4J_USER ?? "neo4j",
    password: process.env.NEO4J_PASSWORD ?? "password",
    systemDb: "system",
    testDb: process.env.E2E_NEO4J_DATABASE ?? "{{name}}test",
  },
  // The PLATFORM ADMINISTRATOR seeded by migration
  // apps/api/src/neo4j.migrations/20250901_004.ts. That migration MERGEs a
  // single User with a fixed id and e-mail and grants it the Administrator role
  // on a platform membership (no IN_COMPANY edge) via the library's
  // `grantPlatformRole`. The password below is the plaintext of the bcrypt hash
  // the migration stores; if that hash is ever regenerated, override both
  // values from `.env.e2e` rather than editing this file.
  administrator: {
    id: "a63553fb-5d3c-11ee-9dc3-0242ac120003",
    email: process.env.E2E_ADMIN_EMAIL ?? "admin@{{name}}.com",
    password: process.env.E2E_ADMIN_PASSWORD ?? "password",
  },
  // A user that is NOT an administrator, created by tests/support/db.ts. It
  // exists so the (admin) route group's role gate can be proved to REFUSE
  // somebody — the highest-value assertion in this suite. Its password hash is
  // copied from the seeded administrator node at seed time, so it logs in with
  // the same plaintext without the suite needing a bcrypt dependency.
  member: {
    id: "6b0a41e7-2f9f-4b8e-9a0e-7c5d3a1f6e24",
    companyId: "c2f6d3ab-8e41-4f0b-9d17-2a5c8b40e913",
    companyName: "E2E Company",
    email: "e2e-member@example.test",
    name: "E2E Member",
  },
  // apps/api/src/neo4j.migrations/20250901_001.ts seeds both Role nodes, and
  // packages/shared re-exports the same ids as `RoleId`. Repeated here because
  // this file is loaded by the Playwright config, which is compiled outside the
  // Next.js path aliases.
  roles: {
    administrator: "53394cb8-1e87-11ef-8b48-bed54b8f8aba",
    companyAdministrator: "2e1eee00-6cba-4506-9059-ccd24e4ea5b0",
  },
} as const;
