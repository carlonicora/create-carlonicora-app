import fs from "node:fs";
import path from "node:path";

/**
 * npm strips leading dots from published files, so the template stores
 * dotfiles undotted and the CLI re-dots them at scaffold time (see
 * src/utils/files.ts DOTFILE_RENAMES). Any comparison between a template path
 * and a real app path MUST go through this mapping — a comparison that skips
 * it reports every dotfile as missing from the app, which is how an earlier
 * audit produced a list of phantom "orphans".
 */
const DOTFILES = {
  gitignore: ".gitignore",
  gitmodules: ".gitmodules",
  gitattributes: ".gitattributes",
  prettierrc: ".prettierrc",
  prettierignore: ".prettierignore",
  npmrc: ".npmrc",
  releaserc: ".releaserc",
  swcrc: ".swcrc",
  "env.example": ".env.example",
  "pnpmfile.cjs": ".pnpmfile.cjs",
};
const UNDOT = Object.fromEntries(Object.entries(DOTFILES).map(([k, v]) => [v, k]));

const swapBasename = (relPath, table) => {
  const dir = path.posix.dirname(relPath);
  const base = path.posix.basename(relPath);
  const mapped = table[base];
  if (!mapped) return relPath;
  return dir === "." ? mapped : `${dir}/${mapped}`;
};

export const templateToAppPath = (relPath) => swapBasename(relPath, DOTFILES);
export const appToTemplatePath = (relPath) => swapBasename(relPath, UNDOT);

/**
 * Glob matching, deliberately minimal: `**` spans separators, `*` does not.
 * A pattern with no wildcard matches the path itself or anything beneath it,
 * so "apps/api/src" ignores the whole subtree.
 */
export function isIgnored(relPath, patterns) {
  const target = relPath.replace(/\\/g, "/");
  return (patterns ?? []).some((pattern) => {
    const p = pattern.replace(/\\/g, "/");
    if (!p.includes("*")) return target === p || target.startsWith(`${p}/`);
    const rx = new RegExp(
      "^" +
        p
          .split("**")
          .map((seg) => seg.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*"))
          .join(".*") +
        "$",
    );
    return rx.test(target);
  });
}

export function loadSources(repoRoot) {
  const file = path.join(repoRoot, "template.sources.json");
  if (!fs.existsSync(file))
    throw new Error(`template.sources.json not found at ${file} — compare-template cannot run without targets`);

  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(parsed.targets) || parsed.targets.length === 0)
    throw new Error("template.sources.json declares no targets");

  const targets = parsed.targets.map((entry) => {
    for (const field of ["name", "path", "appName"]) {
      if (!entry[field]) throw new Error(`target is missing required field "${field}": ${JSON.stringify(entry)}`);
    }
    const dir = path.resolve(repoRoot, entry.path);
    if (!fs.existsSync(dir)) throw new Error(`target "${entry.name}" not found at ${dir}`);
    return { name: entry.name, dir, appName: entry.appName, ignore: entry.ignore ?? [], domains: entry.domains ?? [] };
  });

  return { targets, neverAdopt: parsed.neverAdopt ?? [], templateOnly: parsed.templateOnly ?? [] };
}
