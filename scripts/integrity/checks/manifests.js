import fs from "fs";
import path from "path";

/** Pull every `scripts/...` or `./scripts/...` path out of a package.json scripts block. */
function referencedScriptPaths(pkg) {
  const refs = new Set();
  for (const command of Object.values(pkg.scripts ?? {})) {
    for (const match of command.matchAll(/(?:^|\s)\.?\/?(scripts\/[A-Za-z0-9._/-]+)/g)) refs.add(match[1]);
  }
  return [...refs];
}

export default {
  id: "manifests",
  title: "package.json script refs resolve; packageManager is declared only at root",
  run({ templateDir }) {
    const failures = [];

    // Script references must point at files that exist.
    const rootPkgPath = path.join(templateDir, "package.json");
    const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf8"));
    for (const ref of referencedScriptPaths(rootPkg)) {
      // Bare directory refs like scripts/generate-module are resolved by node at
      // runtime against a package, not a file on disk — only check literal files.
      if (!/\.(js|mjs|cjs|sh|ts)$/.test(ref)) continue;
      if (!fs.existsSync(path.join(templateDir, ref)))
        failures.push(`template/package.json references ${ref}, which does not exist`);
    }

    // Only the root manifest may pin packageManager. A stale nested pin
    // contradicts the root and silently changes which pnpm runs.
    for (const rel of ["apps/api/package.json", "apps/web/package.json", "packages/shared/package.json"]) {
      const full = path.join(templateDir, rel);
      if (!fs.existsSync(full)) continue;
      const pkg = JSON.parse(fs.readFileSync(full, "utf8"));
      if (pkg.packageManager)
        failures.push(`${rel} pins packageManager="${pkg.packageManager}"; only the root manifest may`);
    }

    return failures;
  },
};
