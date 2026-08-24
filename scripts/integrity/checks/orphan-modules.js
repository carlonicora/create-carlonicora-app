import fs from "fs";
import path from "path";
import { walk } from "../lib/walk.js";
import { requireDir } from "../lib/require-dir.js";

/**
 * A module under features/common with no importer anywhere in the template is
 * dead weight shipped into every generated app. Entry points that are wired by
 * convention rather than by import are allowlisted.
 */
const ALLOWLIST = new Set(["index.ts", "index.tsx"]);

/**
 * Scaffolding the template ships ON PURPOSE for the generated app's author to
 * wire up. These have no importer BY DESIGN, so "no importer" does not mean
 * "dead" for them — this is the one distinction the check cannot make on its
 * own, and getting it wrong deletes a feature the template exists to provide.
 *
 * CreationDropDown was designated LIFT-AS-STUB by the retired sync-template
 * copier, and its wiring sits commented-in-place in CommonSidebar.tsx — that
 * commented wiring is now the standing evidence. ErrorContext is a
 * complete ErrorProvider/useErrorHandler pair meant to be mounted in the app's
 * own layout.
 *
 * Add to this list only with that same evidence: a stub designation, or
 * commented-in-place wiring showing intent.
 */
const INTENTIONAL_STUBS = new Set([
  "features/common/components/navigations/CreationDropDown.tsx",
  "features/common/contexts/ErrorContext.tsx",
]);

/**
 * Elimination is ITERATIVE. Dead code arrives in clusters: AccountContext's only
 * importer is AccountContainer, which is itself an orphan. A single pass would
 * clear AccountContainer and pronounce AccountContext live. Repeat to fixpoint.
 */
export default {
  id: "orphan-modules",
  title: "no zero-importer modules under features/common",
  run({ templateDir }) {
    const webSrc = path.join(templateDir, "apps/web/src");
    const missing = requireDir(webSrc, templateDir, "the web app source root");
    if (missing.length) return missing;

    const all = walk(webSrc).filter((f) => /\.(ts|tsx)$/.test(f));
    const sources = new Map(all.map((f) => [f, fs.readFileSync(f, "utf8")]));

    const commonDir = path.join("features", "common");
    const isIntentionalStub = (f) => {
      const rel = path.relative(webSrc, f).split(path.sep).join("/");
      return [...INTENTIONAL_STUBS].some((stub) => rel === stub || rel.endsWith(`/${stub}`));
    };
    const isCandidate = (f) => f.includes(commonDir) && !ALLOWLIST.has(path.basename(f)) && !isIntentionalStub(f);

    const dead = new Set();
    let changed = true;

    while (changed) {
      changed = false;
      for (const file of all) {
        if (dead.has(file) || !isCandidate(file)) continue;
        const stem = path.basename(file).replace(/\.(ts|tsx)$/, "");
        // Match an import specifier ending in the stem, which is how every
        // consumer in this codebase references a module.
        const importPattern = new RegExp(`from\\s+["'\`][^"'\`]*\\b${stem}["'\`]`);
        const hasLiveImporter = [...sources].some(
          ([other, source]) => other !== file && !dead.has(other) && importPattern.test(source),
        );
        if (!hasLiveImporter) {
          dead.add(file);
          changed = true;
        }
      }
    }

    return [...dead]
      .sort()
      .map((file) => `${path.relative(templateDir, file)} has no live importer — dead code in every generated app`);
  },
};
