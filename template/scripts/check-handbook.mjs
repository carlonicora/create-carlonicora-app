#!/usr/bin/env node
// Verifies docs/handbook and README.md against the handbook contract
// (every cited path exists, every relative link and anchor resolves, front matter
// carries exactly `title` and `section`, foundation chapters keep the twelve-heading
// skeleton, and the file list matches disk in both directions).
// Usage: node scripts/check-handbook.mjs [--files f1.md f2.md ...] [--no-manifest]
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const HANDBOOK = join(ROOT, "docs/handbook");

export const EN_MANIFEST = `
README.md
00-start-here/reading-order.md
00-start-here/repo-tour.md
00-start-here/local-setup.md
00-start-here/day-one-checklist.md
00-start-here/glossary.md
00-start-here/task-index.md
01-architecture/topology.md
01-architecture/monorepo-and-build.md
01-architecture/api-and-worker-modes.md
01-architecture/request-lifecycle.md
01-architecture/configuration.md
01-architecture/multi-tenancy-and-security.md
01-architecture/jsonapi-contract.md
01-architecture/entity-descriptors.md
01-architecture/graph-model.md
01-architecture/queues-crons-and-workers.md
01-architecture/realtime.md
01-architecture/notifications-and-email.md
01-architecture/decisions.md
02-framework/overview.md
02-framework/nestjs-neo4jsonapi/public-surface.md
02-framework/nestjs-neo4jsonapi/foundations.md
02-framework/nestjs-neo4jsonapi/agents-and-graphrag.md
02-framework/nestjs-neo4jsonapi/tooling.md
02-framework/nextjs-jsonapi/public-surface.md
02-framework/nextjs-jsonapi/data-layer.md
02-framework/nextjs-jsonapi/components-and-hooks.md
02-framework/nextjs-jsonapi/tooling.md
02-framework/shared-package.md
02-framework/rulebook/README.md
02-framework/rulebook/core-principles.md
02-framework/rulebook/anti-patterns.md
02-framework/rulebook/discipline.md
02-framework/rulebook/date-handling.md
02-framework/rulebook/decisions.md
02-framework/rulebook/feature-template.md
02-framework/rulebook/backend/01-entity-basics.md
02-framework/rulebook/backend/02-dtos.md
02-framework/rulebook/backend/03-repositories.md
02-framework/rulebook/backend/04-services.md
02-framework/rulebook/backend/05-controllers.md
02-framework/rulebook/backend/06-llm-calls.md
02-framework/rulebook/backend/template.md
02-framework/rulebook/frontend/01-models.md
02-framework/rulebook/frontend/02-interfaces.md
02-framework/rulebook/frontend/03-services.md
02-framework/rulebook/frontend/04-components.md
02-framework/rulebook/frontend/05-typography.md
02-framework/rulebook/frontend/06-blocknote.md
02-framework/rulebook/frontend/07-routes-and-cache-components.md
02-framework/rulebook/frontend/template.md
03-backend/bootstrap.md
03-backend/module-anatomy.md
03-backend/rbac-and-permissions.md
03-backend/token-usage-and-credits.md
03-backend/migrations.md
03-backend/testing.md
04-frontend/app-shell-and-routing.md
04-frontend/bootstrap-and-modules.md
04-frontend/feature-anatomy.md
04-frontend/auth-and-onboarding.md
04-frontend/access-control.md
04-frontend/ui-system.md
04-frontend/realtime-notifications-pwa.md
04-frontend/i18n-and-theme.md
04-frontend/admin-console.md
04-frontend/testing.md
05-foundations/README.md
05-foundations/_template.md
05-foundations/identity-and-tenancy.md
05-foundations/modules-features-and-rbac.md
05-foundations/two-factor-and-oauth.md
05-foundations/notifications-and-push.md
05-foundations/content-and-storage.md
05-foundations/knowledge-graph-and-retrieval.md
05-foundations/assistant-and-actions.md
05-foundations/billing-and-token-usage.md
05-foundations/audit-and-activity.md
05-foundations/growth-and-help.md
06-ai/llm-layer.md
06-ai/agents.md
06-ai/eval-and-cost.md
07-operations/docker.md
07-operations/deployment.md
07-operations/environments.md
07-operations/data-stores.md
07-operations/backup-and-recovery.md
07-operations/secrets.md
07-operations/observability.md
07-operations/release.md
07-operations/runbooks.md
08-workflow/contributing.md
08-workflow/conventions.md
08-workflow/testing-strategy.md
08-workflow/ai-assisted-development.md
08-workflow/known-traps.md
08-workflow/known-drift.md
`
  .trim()
  .split("\n");

// The twelve H2 sections every 05-foundations chapter carries, in order.
export const DOMAIN_HEADINGS = [
  "Purpose",
  "Vocabulary",
  "Graph model",
  "Backend",
  "Frontend",
  "Flows",
  "Background jobs",
  "Permissions and gating",
  "Configuration",
  "Tests",
  "Where to look",
  "Gaps and drift",
];

export const FRONT_MATTER_KEYS = ["title", "section"];

// Mirrors DOTFILE_RENAMES in the scaffolder (src/utils/files.ts): npm strips
// dotfiles from a published package, so the template stores them un-dotted and
// the scaffolder puts the dot back. Pages cite the generated-app spelling.
export const DOTFILE_RENAMES = {
  gitignore: ".gitignore",
  gitmodules: ".gitmodules",
  gitattributes: ".gitattributes",
  prettierrc: ".prettierrc",
  prettierignore: ".prettierignore",
  npmrc: ".npmrc",
  releaserc: ".releaserc",
  swcrc: ".swcrc",
  "env.example": ".env.example",
  "env.e2e.example": ".env.e2e.example",
  "pnpmfile.cjs": ".pnpmfile.cjs",
};

// The two framework packages are git submodules. Inside template/, and after a
// `--skip-git` scaffold, they are empty placeholders.
export const SUBMODULE_DIRS = ["packages/nestjs-neo4jsonapi", "packages/nextjs-jsonapi"];

const PATH_PREFIX = /^(apps|packages|scripts|docs|test|tests|\.github|\.husky|\.claude|\.vscode)\//;
const SKIP_CHARS = /[*<>{}$…]/;

function stripFences(md) {
  return md.replace(/```[\s\S]*?```/g, "");
}

/** True when the script runs inside template/, where root dotfiles are stored un-dotted. */
export function isTemplateMode(root = ROOT, exists = existsSync) {
  return exists(join(root, "gitmodules")) && !exists(join(root, ".gitmodules"));
}

/**
 * The un-dotted spelling of a cited dotfile, or null when the token is not one.
 * `.env.example` -> `env.example`, `apps/web/.swcrc` -> `apps/web/swcrc`.
 */
export function undottedSpelling(token) {
  const parts = token.split("/");
  const base = parts[parts.length - 1];
  if (!base.startsWith(".")) return null;
  const undotted = base.slice(1);
  if (!Object.prototype.hasOwnProperty.call(DOTFILE_RENAMES, undotted)) return null;
  parts[parts.length - 1] = undotted;
  return parts.join("/");
}

/** Resolve a repo-relative cited path, falling back to the un-dotted spelling in template mode. */
export function resolveCitedPath(token, { root = ROOT, templateMode = false, exists = existsSync } = {}) {
  if (exists(join(root, token))) return join(root, token);
  if (!templateMode) return null;
  const alt = undottedSpelling(token);
  if (alt && exists(join(root, alt))) return join(root, alt);
  return null;
}

/** True when a submodule directory is absent, empty, or holds only its .gitkeep placeholder. */
export function isUninitialisedSubmodule(dir, { root = ROOT, exists = existsSync, readdir = readdirSync } = {}) {
  const abs = join(root, dir);
  if (!exists(abs)) return true;
  let entries;
  try {
    entries = readdir(abs);
  } catch {
    return true;
  }
  return entries.filter((e) => e !== ".gitkeep" && e !== ".DS_Store").length === 0;
}

/** The submodule a repo-relative path belongs to, when that submodule is not initialised. */
export function submoduleSkip(relPath, opts = {}) {
  const normalised = relPath.replace(/\\/g, "/");
  for (const dir of SUBMODULE_DIRS) {
    if (normalised === dir || normalised.startsWith(`${dir}/`)) {
      if (isUninitialisedSubmodule(dir, opts)) return dir;
    }
  }
  return null;
}

export function extractInlinePaths(md, rootEntries) {
  const out = [];
  const body = stripFences(md);
  const re = /`([^`\n]+)`/g;
  let m;
  while ((m = re.exec(body))) {
    const token = m[1].trim();
    if (SKIP_CHARS.test(token)) continue;
    if (token.includes(" ")) continue;
    if (PATH_PREFIX.test(token) || rootEntries.includes(token)) {
      if (!out.includes(token)) out.push(token);
    }
  }
  return out;
}

export function extractLinks(md) {
  const out = [];
  const body = stripFences(md);
  const re = /\[[^\]]*\]\(([^)\s]+)\)/g;
  let m;
  while ((m = re.exec(body))) {
    const raw = m[1];
    if (/^(https?:|mailto:|#)/.test(raw)) continue;
    const [target, anchor = ""] = raw.split("#");
    out.push({ target, anchor });
  }
  return out;
}

export function slugify(heading) {
  return heading
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Front matter carries exactly `title` and `section` — no `sources_verified`, no third key. */
export function checkFrontMatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return ["missing front matter"];
  const problems = [];
  const keys = m[1]
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => l.split(":")[0].trim());
  for (const k of FRONT_MATTER_KEYS) if (!keys.includes(k)) problems.push(`front matter missing "${k}"`);
  for (const k of keys) {
    if (!FRONT_MATTER_KEYS.includes(k))
      problems.push(`front matter has unexpected key "${k}" (only ${FRONT_MATTER_KEYS.join(" and ")} are allowed)`);
  }
  return problems;
}

export function checkDomainHeadings(md, headings = DOMAIN_HEADINGS) {
  const h2 = [...stripFences(md).matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
  const problems = [];
  if (h2.length !== headings.length) {
    problems.push(`expected ${headings.length} H2 headings, found ${h2.length}: ${h2.join(" | ")}`);
    return problems;
  }
  headings.forEach((h, i) => {
    if (h2[i] !== h) problems.push(`H2 #${i + 1} should be "${h}", found "${h2[i]}"`);
  });
  return problems;
}

export function findPlaceholders(md) {
  const problems = [];
  const body = stripFences(md);
  for (const re of [/\b(TODO|TBD|FIXME)\b/g, /lorem ipsum/gi]) {
    let m;
    while ((m = re.exec(body))) problems.push(`placeholder "${m[0]}"`);
  }
  return problems;
}

export function isRulebookCopy(absPath) {
  const rel = relative(HANDBOOK, absPath).replace(/\\/g, "/");
  return rel.startsWith("02-framework/rulebook/") && !rel.endsWith("/README.md");
}

/** True for the 05-foundations chapters that must carry the twelve-heading skeleton. */
export function isFoundationChapter(absPath, handbook = HANDBOOK) {
  const rel = relative(handbook, absPath).replace(/\\/g, "/");
  return rel.startsWith("05-foundations/") && rel !== "05-foundations/README.md";
}

function headingsOf(file, exists = existsSync) {
  if (!exists(file)) return new Set();
  const md = readFileSync(file, "utf8");
  return new Set([...stripFences(md).matchAll(/^#{1,6} (.+)$/gm)].map((m) => slugify(m[1])));
}

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith(".md")) acc.push(p);
  }
  return acc;
}

export function checkFile(
  absPath,
  { rootEntries, exists = existsSync, readdir = readdirSync, root = ROOT, handbook = HANDBOOK, templateMode = false, stats } = {}
) {
  const rel = relative(root, absPath);
  const md = readFileSync(absPath, "utf8");
  const problems = [];
  const isRootReadme = rel === "README.md";
  const pathOpts = { root, templateMode, exists, readdir };
  if (!isRootReadme) for (const p of checkFrontMatter(md)) problems.push(p);
  for (const p of findPlaceholders(md)) problems.push(p);
  // Verbatim rulebook copies are never edited; their citations refer to the plugin's
  // own tree, so path and link checks do not apply to them. README.md is authored.
  if (isRulebookCopy(absPath)) return problems.map((p) => `${rel}: ${p}`);
  for (const token of extractInlinePaths(md, rootEntries)) {
    if (resolveCitedPath(token, pathOpts)) continue;
    if (submoduleSkip(token, pathOpts)) {
      if (stats) stats.skipped++;
      continue;
    }
    problems.push(`cited path does not exist: ${token}`);
  }
  for (const { target, anchor } of extractLinks(md)) {
    const abs = resolve(dirname(absPath), target);
    if (!exists(abs)) {
      if (submoduleSkip(relative(root, abs), pathOpts)) {
        if (stats) stats.skipped++;
        continue;
      }
      problems.push(`broken link: ${target}`);
      continue;
    }
    if (anchor && abs.endsWith(".md") && !headingsOf(abs, exists).has(anchor))
      problems.push(`broken anchor: ${target}#${anchor}`);
  }
  if (isFoundationChapter(absPath, handbook)) {
    for (const p of checkDomainHeadings(md)) problems.push(p);
  }
  return problems.map((p) => `${rel}: ${p}`);
}

export function checkManifest(handbook = HANDBOOK, manifest = EN_MANIFEST) {
  const problems = [];
  const found = walk(handbook)
    .map((p) => relative(handbook, p).replace(/\\/g, "/"))
    .sort();
  for (const f of manifest) if (!found.includes(f)) problems.push(`${f}: missing from disk`);
  for (const f of found) if (!manifest.includes(f)) problems.push(`${f}: not in manifest`);
  return problems;
}

/** Root entries, plus the dotted spellings the pages cite when running inside template/. */
export function rootEntriesFor(root = ROOT, templateMode = false, readdir = readdirSync) {
  const entries = readdir(root);
  if (!templateMode) return entries;
  const extra = entries.map((e) => DOTFILE_RENAMES[e]).filter((e) => e && !entries.includes(e));
  return [...entries, ...extra];
}

function main(argv) {
  const files = [];
  let manifest = true;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--files") {
      while (argv[i + 1] && !argv[i + 1].startsWith("--")) files.push(resolve(ROOT, argv[++i]));
    } else if (argv[i] === "--no-manifest") manifest = false;
  }
  const templateMode = isTemplateMode();
  const rootEntries = rootEntriesFor(ROOT, templateMode);
  const targets = files.length ? files : [join(ROOT, "README.md"), ...walk(HANDBOOK)];
  const stats = { skipped: 0 };
  const problems = [];
  for (const f of targets) problems.push(...checkFile(f, { rootEntries, templateMode, stats }));
  if (manifest && !files.length) problems.push(...checkManifest());
  if (problems.length) {
    console.error(problems.join("\n"));
    console.error(`\n${problems.length} problem(s)`);
    process.exit(1);
  }
  const skipNote = stats.skipped
    ? `, ${stats.skipped} package path(s) skipped (submodules not initialised)`
    : "";
  console.log(`check-handbook: ${targets.length} file(s) clean${skipNote}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
