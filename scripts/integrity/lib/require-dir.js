import fs from "fs";
import path from "path";

/**
 * Assert that a directory a check depends on actually exists.
 *
 * Without this, a check whose target path moves keeps printing PASS while
 * inspecting nothing — the worst failure a gate can have, because it is
 * indistinguishable from success. Every check that walks a fixed, expected
 * root must call this first.
 *
 * Returns a failure-message array (empty when the directory is present) so a
 * caller can `const missing = requireDir(...); if (missing.length) return missing;`
 */
export function requireDir(dir, templateDir, why) {
  if (fs.existsSync(dir)) return [];
  return [`expected directory is missing: ${path.relative(templateDir, dir)} — ${why}. This check inspected nothing.`];
}
