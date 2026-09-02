#!/usr/bin/env node
/**
 * Regenerates versions.production.json from the workspace packages themselves.
 *
 * The file pins the npm versions that scripts/apply-production-versions.js
 * substitutes for `workspace:*` in the Docker build, so its keys are derived —
 * not hand-maintained: every publishable (non-private) workspace package that
 * an app depends on via `workspace:*`, at the version in its own package.json.
 * Private packages are skipped: they are copied into the image as source, so
 * pinning them to an npm version would break the build.
 *
 * Usage:
 *   node scripts/sync-production-versions.js            # write the file
 *   node scripts/sync-production-versions.js --check    # exit 1 if stale
 *
 * Rule 5 of scripts/check-dep-drift.js verifies the result; this is the fix.
 * No external dependencies on purpose.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const TARGET = path.join(ROOT, "versions.production.json");
const APPS = ["apps/api", "apps/web"];

const check = process.argv.includes("--check");

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

/** Every directory matched by the `packages:` globs in pnpm-workspace.yaml. */
function workspacePackages() {
  const yaml = fs.readFileSync(path.join(ROOT, "pnpm-workspace.yaml"), "utf8");
  const section = yaml.split(/^packages:/m)[1]?.split(/^\w/m)[0] || "";
  const globs = [...section.matchAll(/^\s*-\s*'?([^'\n#]+?)'?\s*$/gm)].map((m) => m[1]);

  const byName = new Map();
  for (const glob of globs) {
    const [dir, star] = glob.split("/");
    if (star !== "*") continue; // only the `<dir>/*` form is used here
    const base = path.join(ROOT, dir);
    if (!fs.existsSync(base)) continue;
    for (const entry of fs.readdirSync(base)) {
      const manifest = path.join(base, entry, "package.json");
      if (!fs.existsSync(manifest)) continue;
      const pkg = readJson(manifest);
      if (pkg.name) byName.set(pkg.name, { ...pkg, dir: path.join(dir, entry) });
    }
  }
  return byName;
}

const packages = workspacePackages();
const problems = [];
const skipped = [];
const pins = {};

for (const app of APPS) {
  const manifestPath = path.join(ROOT, app, "package.json");
  if (!fs.existsSync(manifestPath)) continue;
  const pkg = readJson(manifestPath);

  for (const section of ["dependencies", "devDependencies"]) {
    for (const [dep, range] of Object.entries(pkg[section] || {})) {
      if (!String(range).startsWith("workspace:")) continue;

      const target = packages.get(dep);
      if (!target) {
        problems.push(`${app} depends on ${dep} as ${range} but no workspace package declares that name`);
        continue;
      }
      if (target.private === true) {
        skipped.push(`${dep} (private — shipped as source, not pinned)`);
        continue;
      }
      if (!target.version) {
        problems.push(`${target.dir}/package.json has no version — cannot pin ${dep}`);
        continue;
      }
      pins[dep] = target.version;
    }
  }
}

if (problems.length) {
  console.error(`✖ cannot sync versions.production.json (${problems.length}):\n`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}

const next = {};
for (const name of Object.keys(pins).sort()) next[name] = pins[name];
const serialised = JSON.stringify(next, null, 2) + "\n";

const current = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, "utf8") : "";
const previous = current ? JSON.parse(current) : {};

const changes = [];
for (const [name, version] of Object.entries(next))
  if (previous[name] !== version)
    changes.push(`${name}: ${previous[name] ?? "(absent)"} → ${version}`);
for (const name of Object.keys(previous))
  if (!(name in next)) changes.push(`${name}: ${previous[name]} → removed (no app depends on it via workspace:*)`);

for (const s of new Set(skipped)) console.log(`  skipped ${s}`);

if (serialised === current) {
  console.log("✓ versions.production.json already matches the workspace packages");
  process.exit(0);
}

if (check) {
  console.error("✖ versions.production.json is stale:\n");
  for (const c of changes) console.error("  - " + c);
  console.error("\nRun: pnpm sync:versions");
  process.exit(1);
}

fs.writeFileSync(TARGET, serialised);
console.log("✓ versions.production.json updated:\n");
for (const c of changes) console.log("  - " + c);
