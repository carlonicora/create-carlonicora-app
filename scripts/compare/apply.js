import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generalize } from "./lib/generalize.js";
import { loadSources, templateToAppPath } from "./lib/sources.js";
import { isBinaryFile } from "./lib/content.js";
import { isMain } from "./lib/main-guard.js";

/**
 * True when `child` is inside `parent`. Without this, a malformed report row
 * or a typo — the path list is composed by a session reading the report — let
 * `applyPaths` read outside the target and WRITE outside template/, then print
 * the escape as `applied`.
 */
function isInside(parent, child) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * Copy a REVIEWED subset of paths from one target into template/.
 *
 * Deliberately dumb: it adopts exactly what it is handed. Judgement happens
 * before this function is called — that separation is the whole reason the
 * old blind whole-tree sync is being retired.
 */
export function applyPaths({ repoRoot, target, paths, dryRun = false }) {
  const templateDir = path.join(repoRoot, "template");
  const applied = [];
  const skipped = [];

  for (const rel of paths) {
    const appRel = templateToAppPath(rel);
    const source = path.join(target.dir, appRel);
    const destination = path.join(templateDir, rel);
    if (!isInside(target.dir, source) || !isInside(templateDir, destination)) {
      skipped.push({ path: rel, reason: "path escapes the target or template/ root" });
      continue;
    }
    if (!fs.existsSync(source)) {
      skipped.push({ path: rel, reason: `not present in target ${target.name}` });
      continue;
    }
    if (dryRun) {
      applied.push(rel);
      continue;
    }
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (isBinaryFile(source)) {
      fs.copyFileSync(source, destination);
    } else {
      fs.writeFileSync(destination, generalize(fs.readFileSync(source, "utf8"), target.appName), "utf8");
    }
    applied.push(rel);
  }

  return { applied, skipped };
}

export function resolveTarget(repoRoot, name) {
  const { targets } = loadSources(repoRoot);
  const target = targets.find((t) => t.name === name);
  if (!target) throw new Error(`unknown target "${name}" — declared targets: ${targets.map((t) => t.name).join(", ")}`);
  return target;
}

/**
 * Parse `--target <name> --paths <a,b,c>` (also accepts repeated --paths and
 * space-separated values). Returns null when required args are absent, so the
 * caller can print usage instead of no-opping.
 */
export function parseArgs(argv) {
  const parsed = { target: null, paths: [], dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
    } else if (arg === "--target") {
      parsed.target = argv[++i] ?? null;
    } else if (arg.startsWith("--target=")) {
      parsed.target = arg.slice("--target=".length);
    } else if (arg === "--paths") {
      // Consume every following value until the next flag, so both
      // `--paths a,b` and `--paths a b` work.
      while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        parsed.paths.push(...argv[++i].split(",").filter(Boolean));
      }
    } else if (arg.startsWith("--paths=")) {
      parsed.paths.push(...arg.slice("--paths=".length).split(",").filter(Boolean));
    }
  }
  if (!parsed.target || parsed.paths.length === 0) return null;
  return parsed;
}

const USAGE = `Usage: pnpm template:apply --target <name> --paths <a,b,c> [--dry-run]

Copies a REVIEWED subset of paths from one configured target into template/,
re-generalizing each file. Decide what to adopt with the template-sync skill
first — this command executes a decision, it does not make one.`;

if (isMain(import.meta.url)) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const args = parseArgs(process.argv.slice(2));
  // Exit non-zero on missing args: this command's whole job is to write files,
  // so a silent no-op reads as success and is the worst possible outcome.
  if (!args) {
    console.error(USAGE);
    process.exit(1);
  }
  const target = resolveTarget(repoRoot, args.target);
  const { applied, skipped } = applyPaths({ repoRoot, target, paths: args.paths, dryRun: args.dryRun });
  const prefix = args.dryRun ? "would apply" : "applied";
  for (const rel of applied) console.log(`${prefix}  ${rel}`);
  for (const { path: rel, reason } of skipped) console.log(`skipped  ${rel} — ${reason}`);
  console.log(`\n${applied.length} ${prefix}, ${skipped.length} skipped, from target "${target.name}".`);
  if (skipped.length) process.exit(1);
}
