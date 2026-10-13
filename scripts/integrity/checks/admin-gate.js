import fs from "fs";
import path from "path";
import { walk } from "../lib/walk.js";
import { requireDir } from "../lib/require-dir.js";

/**
 * Under Cache Components the (admin) layout no longer reads the session: nothing
 * on the path from a layout to its children may await. The gate is
 * `requireAdministrator(locale)`, called by every administration page, and it is
 * the only thing standing between an ordinary authenticated user and that page.
 * `isLogged()` alone is not a gate.
 */
const GUARD = "apps/web/src/features/common/components/session/requireAdministrator.ts";

export default {
  id: "admin-gate",
  title: "every (admin) page enforces the Administrator role",
  run({ templateDir }) {
    const adminRoot = path.join(templateDir, "apps/web/src/app/[locale]/(admin)");
    const missing = requireDir(adminRoot, templateDir, "the (admin) route subtree the Administrator gate protects");
    if (missing.length) return missing;

    const failures = [];

    const guardPath = path.join(templateDir, GUARD);
    if (!fs.existsSync(guardPath)) {
      failures.push(`${GUARD} is missing — the (admin) pages have no gate at all`);
    } else if (!/hasRole\s*\(\s*RoleId\.Administrator\s*\)/.test(fs.readFileSync(guardPath, "utf8"))) {
      failures.push(`${GUARD} does not check ServerSession.hasRole(RoleId.Administrator)`);
    }

    const pages = walk(adminRoot).filter((f) => f.endsWith("page.tsx"));
    if (pages.length === 0) failures.push("(admin) contains no pages — check the path");

    for (const page of pages) {
      if (!/await\s+requireAdministrator\s*\(/.test(fs.readFileSync(page, "utf8")))
        failures.push(`${path.relative(adminRoot, page)} does not await requireAdministrator(locale)`);
    }

    return failures;
  },
};
