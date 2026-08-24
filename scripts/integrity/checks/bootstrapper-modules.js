import fs from "fs";
import path from "path";
import { walk } from "../lib/walk.js";
import { resolveLibraryPaths } from "../lib/config.js";
import { requireDir } from "../lib/require-dir.js";

/**
 * Comments must go before scanning. The library documents this very failure
 * mode in prose — "so `Modules.X` typechecks and is `undefined` at runtime" —
 * and a naive scan turns that sentence into a demand to register a module
 * called `X`. Stripping comments is the difference between reading code and
 * reading commentary about code.
 */
export const stripComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // `[^:]` guards `://` — without it, any line containing "https://" is
    // truncated at the URL, and a `Modules.X` reference after it is silently
    // dropped. That is the UNDER-report direction on the one check nothing
    // else in the toolchain replaces.
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

/** Every `Modules.X` the library's own feature code dereferences at runtime. */
function modulesUsedByLibrary(libDir) {
  const used = new Set();
  const root = path.join(libDir, "src");
  for (const file of walk(root).filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes("__tests__"))) {
    const source = stripComments(fs.readFileSync(file, "utf8"));
    for (const match of source.matchAll(/\bModules\.([A-Z][A-Za-z0-9]*)/g)) used.add(match[1]);
  }
  return used;
}

/**
 * Names the template registers. Two forms appear in allModules:
 *   Foo: FooModule(moduleFactory)            -> "Foo"
 *   ...tokenUsageModules(moduleFactory)      -> resolved from the library helper
 */
function modulesRegisteredByTemplate(bootstrapperSource, libDir) {
  const registered = new Set();
  for (const match of bootstrapperSource.matchAll(/^\s{2}([A-Z][A-Za-z0-9]*)\s*:/gm)) registered.add(match[1]);

  for (const match of bootstrapperSource.matchAll(/\.\.\.\s*([a-z][A-Za-z0-9]*)\s*\(/g)) {
    const helper = match[1];
    for (const file of walk(path.join(libDir, "src")).filter((f) => f.endsWith(".ts"))) {
      const source = fs.readFileSync(file, "utf8");
      const declaration = source.match(new RegExp(`export const ${helper}\\s*=[\\s\\S]*?\\{([\\s\\S]*?)\\}\\s*\\)?\\s*satisfies`));
      if (!declaration) continue;
      for (const key of declaration[1].matchAll(/^\s*([A-Z][A-Za-z0-9]*)\s*:/gm)) registered.add(key[1]);
      break;
    }
  }
  return registered;
}

export default {
  id: "bootstrapper-modules",
  title: "every Modules.X the library uses is registered in the template Bootstrapper",
  run(ctx) {
    const libs = resolveLibraryPaths(ctx);
    const libDir = libs["@carlonicora/nextjs-jsonapi"];
    const missing = requireDir(path.join(libDir, "src"), ctx.templateDir, "the library source root this check scans");
    if (missing.length) return missing;

    const bootstrapperPath = path.join(ctx.templateDir, "apps/web/src/config/Bootstrapper.ts");
    if (!fs.existsSync(bootstrapperPath))
      return [`expected file is missing: apps/web/src/config/Bootstrapper.ts — this check inspected nothing.`];
    const source = fs.readFileSync(bootstrapperPath, "utf8");

    const used = modulesUsedByLibrary(libDir);
    const registered = modulesRegisteredByTemplate(source, libDir);

    return [...used]
      .filter((name) => !registered.has(name))
      .sort()
      .map((name) => `Modules.${name} is used by the library but not registered in Bootstrapper.ts (undefined at runtime)`);
  },
};
