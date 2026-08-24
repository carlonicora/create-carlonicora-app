import fs from "fs";
import path from "path";

/**
 * Resolve the two library checkouts. Checks that compare template code against
 * the real library cannot run without them. When they are absent we raise a
 * SKIP rather than a failure, so the harness stays usable on a machine that has
 * only this repo cloned — `--strict` turns skips into failures for CI.
 */
export function resolveLibraryPaths({ repoRoot, config }) {
  const override = process.env.INTEGRITY_LIB_ROOT;
  const declared = config.libraries ?? {};
  const resolved = {};

  for (const [name, rel] of Object.entries(declared)) {
    const dir = override ? path.join(override, path.basename(rel)) : path.resolve(repoRoot, rel);
    if (!fs.existsSync(path.join(dir, "package.json"))) {
      const error = new Error(`library checkout not found for ${name} (looked in ${dir})`);
      error.code = "SKIP";
      throw error;
    }
    resolved[name] = dir;
  }

  if (Object.keys(resolved).length === 0) {
    const error = new Error("integrity.config.json declares no libraries");
    error.code = "SKIP";
    throw error;
  }
  return resolved;
}
