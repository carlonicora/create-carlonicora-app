import { test as setup } from "@playwright/test";
import { E2E } from "../e2e.env";
import { loginAndSaveState } from "../support/auth";
import { createNonAdministratorUser } from "../support/db";

/**
 * The `setup` project. Every other project declares it as a dependency, so it
 * runs exactly once per suite — including on a scoped run.
 *
 * The database itself is already recreated and migrated by the time this runs:
 * `scripts/e2e.sh` drops and creates it, then waits for the worker's migrator.
 * What is left is the fixtures the migrations do not seed, and the browser
 * sessions the other projects reuse.
 */
setup("seed fixtures and authenticate", async ({ browser }) => {
  setup.setTimeout(180000);

  // The non-administrator the (admin) route group's gate is proved against.
  await createNonAdministratorUser();

  // The platform administrator seeded by migration 20250901_004.
  const administrator = await loginAndSaveState({
    browser,
    email: E2E.administrator.email,
    password: E2E.administrator.password,
    authFile: "playwright/.auth/admin.json",
  });
  if (!administrator.roleIds.includes(E2E.roles.administrator)) {
    throw new Error(
      "the seeded administrator did not come back holding the Administrator role — " +
        "check migration 20250901_004 and the platform membership it grants",
    );
  }

  // The same administrator, bound to the literal "localhost" origin — the only
  // origin Chromium treats as a secure context over plain HTTP, which the
  // service worker needs. Cookies are domain-scoped, so the state above does
  // not authenticate localhost; this one does. Consumed by the chromium-pwa project.
  await loginAndSaveState({
    browser,
    email: E2E.administrator.email,
    password: E2E.administrator.password,
    authFile: "playwright/.auth/admin-localhost.json",
    webBase: E2E.webBaseLocalhost,
    cookieDomain: "localhost",
  });

  // The ordinary user. Consumed by tests that assert a REFUSAL, so its session
  // must be real and it must genuinely lack the Administrator role. Its
  // password hash is copied from the administrator node by
  // createNonAdministratorUser, so the two personas share one plaintext.
  const member = await loginAndSaveState({
    browser,
    email: E2E.member.email,
    password: E2E.administrator.password,
    authFile: "playwright/.auth/member.json",
  });
  if (member.roleIds.includes(E2E.roles.administrator)) {
    throw new Error(
      "the non-administrator fixture came back holding the Administrator role — " +
        "the 403 assertions downstream would pass for the wrong reason",
    );
  }
});
