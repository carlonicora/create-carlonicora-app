import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { generalize } from "./lib/generalize.js";
import { buildGitIndex } from "./lib/git-index.js";
import { loadSources, isIgnored, appToTemplatePath, templateToAppPath } from "./lib/sources.js";
import { classifyRow } from "./lib/classify.js";
import { readComparableBody, normaliseText, isOpaqueBody } from "./lib/content.js";
import { isMain } from "./lib/main-guard.js";
import { renderMarkdown, renderJson } from "./report.js";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".next", ".turbo", "coverage", ".worktrees"]);

/** Junk that must never be offered as an adoption candidate from either side. */
const JUNK = /(^|\/)(\.DS_Store|Thumbs\.db)$|\.tsbuildinfo$/;

function walk(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), base, out);
    } else {
      out.push(path.relative(base, path.join(dir, entry.name)).split(path.sep).join("/"));
    }
  }
  return out;
}

/**
 * Enumerate a target's TRACKED files.
 *
 * This must not be a filesystem walk. A walk reads the working tree, which
 * contains everything the project deliberately does not commit — and those
 * files were then presented as adoption candidates: real ones observed were
 * `.env`, `apps/api/.env.prod.local`, `apps/web/playwright/.auth/user.json`
 * and `.claude/settings.local.json`. Adopting any of them copies a live secret
 * into `template/`, which `package.json`'s `files` array publishes to npm.
 *
 * `git ls-files` also drops .DS_Store, .husky/_/*, build caches and dump
 * directories for free, without one ignore-list entry per project.
 */
export function listTrackedFiles(repoDir) {
  const raw = execFileSync("git", ["ls-files", "-z"], {
    cwd: repoDir,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  return raw.split("\0").filter(Boolean);
}

export function compareTemplate({ repoRoot, outDir = repoRoot }) {
  const { targets, neverAdopt, templateOnly } = loadSources(repoRoot);
  const templateDir = path.join(repoRoot, "template");

  const gitIndexes = new Map(targets.map((t) => [t.name, buildGitIndex(t.dir)]));

  const templatePaths = walk(templateDir).filter((rel) => !JUNK.test(rel));
  const seen = new Set(templatePaths);

  // Target-only candidates: anything a target TRACKS that the template does
  // not have, minus that target's ignore list.
  for (const target of targets) {
    for (const appRel of listTrackedFiles(target.dir)) {
      if (JUNK.test(appRel)) continue;
      if (isIgnored(appRel, target.ignore)) continue;
      const rel = appToTemplatePath(appRel);
      if (!seen.has(rel)) seen.add(rel);
    }
  }

  const rows = [];
  for (const rel of [...seen].sort()) {
    const templateFile = path.join(templateDir, rel);
    const inTemplate = fs.existsSync(templateFile) && fs.statSync(templateFile).isFile();
    const templateBody = inTemplate ? normaliseText(readComparableBody(templateFile)) : null;

    const rowTargets = targets.map((target) => {
      // The template stores dotfiles undotted ("gitignore"); the app has
      // ".gitignore". Try the mapped name first, then the literal one — a
      // comparison that skips this reports every dotfile as missing, which is
      // exactly how an earlier hand-audit produced a list of phantom orphans.
      const candidates = [templateToAppPath(rel), rel];
      let file = null;
      for (const candidate of candidates) {
        const full = path.join(target.dir, candidate);
        if (fs.existsSync(full) && fs.statSync(full).isFile()) { file = { full, rel: candidate }; break; }
      }
      if (!file || isIgnored(file.rel, target.ignore))
        return { name: target.name, present: false, body: null, git: null };

      const raw = readComparableBody(file.full);
      // A binary's digest must not go through generalize() — there is no app
      // name inside a hash, and rewriting one would only corrupt it.
      const body = isOpaqueBody(raw) ? raw : normaliseText(generalize(raw, target.appName, { domains: target.domains }));
      return {
        name: target.name,
        present: true,
        body,
        git: gitIndexes.get(target.name).get(file.rel) ?? null,
      };
    });

    // A path in neither the template nor any target is not a row at all. It
    // arises from broken symlinks and symlinked directories, and previously
    // surfaced as TEMPLATE_ONLY — sending a reader to look for a file that
    // does not exist.
    if (!inTemplate && !rowTargets.some((t) => t.present)) continue;

    rows.push(classifyRow({ rel, inTemplate, templateBody, targets: rowTargets, neverAdopt, templateOnly }));
  }

  const meta = { targets: targets.map((t) => t.name), generatedAt: new Date().toISOString() };
  const markdown = renderMarkdown(rows, meta);
  const json = renderJson(rows, meta);

  fs.writeFileSync(path.join(outDir, "template-drift-report.md"), markdown, "utf8");
  fs.writeFileSync(path.join(outDir, "template-drift-report.json"), JSON.stringify(json, null, 2), "utf8");

  return { rows, markdown, json };
}

if (isMain(import.meta.url)) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const { rows, json } = compareTemplate({ repoRoot });
  for (const [key, count] of Object.entries(json.meta.counts)) console.log(`${key.padEnd(14)} ${count}`);
  console.log(`\n${rows.length} paths compared. Reports written to template-drift-report.{md,json}`);
}
