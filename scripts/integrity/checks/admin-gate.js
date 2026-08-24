import fs from "fs";
import path from "path";
import { walk } from "../lib/walk.js";
import { requireDir } from "../lib/require-dir.js";

/**
 * The (admin) layout is the only thing standing between an ordinary
 * authenticated user and every administration page — the routes beneath it
 * carry no auth of their own. `isLogged()` alone is not a gate.
 */
export default {
  id: "admin-gate",
  title: "the (admin) subtree enforces the Administrator role",
  run({ templateDir }) {
    const adminRoot = path.join(templateDir, "apps/web/src/app/[locale]/(admin)");
    const missing = requireDir(adminRoot, templateDir, "the (admin) route subtree the Administrator gate protects");
    if (missing.length) return missing;

    const layoutPath = path.join(adminRoot, "layout.tsx");
    if (!fs.existsSync(layoutPath)) return ["(admin)/layout.tsx is missing — the subtree has no gate at all"];

    const layout = fs.readFileSync(layoutPath, "utf8");
    const failures = [];
    if (!/hasRole\s*\(\s*RoleId\.Administrator\s*\)/.test(layout))
      failures.push("(admin)/layout.tsx does not check ServerSession.hasRole(RoleId.Administrator)");

    // Every page under (admin) must be reachable only through that layout.
    const pages = walk(adminRoot).filter((f) => f.endsWith("page.tsx"));
    if (pages.length === 0) failures.push("(admin) contains no pages — check the path");

    return failures;
  },
};
