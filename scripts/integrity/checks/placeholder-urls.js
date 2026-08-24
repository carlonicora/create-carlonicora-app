import path from "path";
import fs from "fs";
import { walk } from "../lib/walk.js";
import { requireDir } from "../lib/require-dir.js";

/**
 * `new URL("myapp.com")` throws TypeError: Invalid URL — a one-argument URL
 * needs a scheme. Placeholders are substituted verbatim at scaffold time, so a
 * bare `{{name}}.com` inside new URL() is a guaranteed runtime crash in every
 * generated app, and generateMetadata backs nearly every page.
 *
 * ONLY the one-argument form is a defect. `new URL(path, base)` is valid and
 * idiomatic with a schemeless first argument — the base supplies the origin,
 * and `new URL("/login", request.url)` is the documented Next.js middleware
 * redirect. Flagging it would push authors to rewrite correct code.
 */
const NEW_URL_CALL = /new URL\(\s*([^)]*)\)/g;

export default {
  id: "placeholder-urls",
  title: "no single-argument new URL() on a schemeless literal",
  run({ templateDir }) {
    const failures = [];
    const roots = [path.join(templateDir, "apps/web/src"), path.join(templateDir, "apps/api/src")];
    for (const root of roots) {
      // Guard every root we scan, not just the first: an unguarded root that
      // goes missing makes walk() return [] and this check pass while
      // inspecting nothing — the failure requireDir exists to prevent.
      const missing = requireDir(root, templateDir, "a source root this check scans");
      if (missing.length) {
        failures.push(...missing);
        continue;
      }
      for (const file of walk(root).filter((f) => /\.(ts|tsx)$/.test(f))) {
        const source = fs.readFileSync(file, "utf8");
        for (const match of source.matchAll(NEW_URL_CALL)) {
          const args = match[1];
          // Two-argument form: the base carries the origin. Not our business.
          // A nested call means `[^)]*` truncated at the inner `)`, so the
          // trailing literal we would read belongs to the inner call, not to
          // new URL — judging it produces exactly the false positive this
          // check was rewritten to eliminate. Refuse to judge either shape.
          if (args.includes(",") || args.includes("(")) continue;
          // Take the trailing literal so `ENV.APP_URL ?? "fallback"` is judged
          // on the fallback. A non-literal argument cannot be judged statically.
          const literal = args.match(/["'`]([^"'`]+)["'`]\s*$/);
          if (!literal) continue;
          // A template literal with an interpolation cannot be judged
          // statically — the scheme may come from the interpolated value.
          if (literal[1].includes("${")) continue;
          // Any scheme, not just http(s): mailto:, tel:, blob: are all valid.
          if (/^[a-z][a-z0-9+.-]*:/i.test(literal[1])) continue;
          failures.push(
            `${path.relative(templateDir, file)}: new URL("${literal[1]}") has no scheme — throws Invalid URL`,
          );
        }
      }
    }
    return failures;
  },
};
