#!/usr/bin/env node
/**
 * Dependency drift check.
 *
 * Guards the workspace's dependency invariants:
 *   1. Apps provide every non-optional peer of the workspace lib they consume,
 *      with a range that satisfies the lib's floor.
 *   2. A dep declared by BOTH an app and its lib must use an IDENTICAL range
 *      and be on the app's justified-overlap allowlist below (drift here is
 *      how silent duplicate library copies are born).
 *   3. devDependencies declared in 2+ workspace manifests must use identical
 *      ranges.
 *   4. pnpm-workspace.yaml overrides must not contradict OR UNDERCUT manifest
 *      declarations — a pnpm override REPLACES declared ranges rather than
 *      intersecting them, so an override below a declared floor silently
 *      resolves beneath it with no peer warning.
 *   5. versions.production.json must match the workspace packages' versions.
 *
 * Exit 1 on any violation. No external dependencies on purpose.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));

for (const sub of ["packages/nestjs-neo4jsonapi/package.json", "packages/nextjs-jsonapi/package.json"]) {
  if (!fs.existsSync(path.join(ROOT, sub))) {
    console.error(`✖ ${sub} not found — initialise the submodules first: git submodule update --init`);
    process.exit(1);
  }
}

/** Parse the `catalog:` section of pnpm-workspace.yaml (flat key: value pairs). */
const catalog = (() => {
  const yaml = fs.readFileSync(path.join(ROOT, "pnpm-workspace.yaml"), "utf8");
  const section = yaml.split(/^catalog:/m)[1]?.split(/^\w/m)[0] || "";
  const out = {};
  for (const m of section.matchAll(/^  ('?)([^\s:']+)\1:\s*('?)([^'\n#]+)\3\s*$/gm))
    out[m[2]] = m[4].trim();
  return out;
})();

/** Resolve "catalog:" references to their concrete range so comparisons are semantic. */
const resolveRange = (dep, range) =>
  String(range).startsWith("catalog:") ? (catalog[dep] ?? range) : range;

const resolveManifest = (pkg) => {
  const clone = JSON.parse(JSON.stringify(pkg));
  for (const sec of ["dependencies", "devDependencies"])
    for (const [dep, range] of Object.entries(clone[sec] || {}))
      clone[sec][dep] = resolveRange(dep, range);
  return clone;
};

const manifests = {
  root: resolveManifest(read("package.json")),
  api: resolveManifest(read("apps/api/package.json")),
  web: resolveManifest(read("apps/web/package.json")),
  nest: resolveManifest(read("packages/nestjs-neo4jsonapi/package.json")),
  next: resolveManifest(read("packages/nextjs-jsonapi/package.json")),
  shared: resolveManifest(read("packages/shared/package.json")),
};

/**
 * Deps an app is allowed to declare even though its lib also declares them
 * (as regular dependencies). Everything here is either imported directly by
 * the app's own source, or a required peer of a package the app itself
 * declares (with autoInstallPeers off, the host must provide those). Adding a
 * new overlap requires adding it here WITH the same range as the lib (rule 2
 * still applies), or removing the app-side declaration.
 */
const OVERLAP_ALLOWLIST = {
  api: [
    // imported directly by app source:
    "@langchain/community", "@langchain/core", "@langchain/textsplitters",
    "class-validator", "fastify", "neo4j-driver",
    // required peers of app-declared packages:
    "bullmq", // @nestjs/bullmq
    "rxjs", // @nestjs/common
    "passport", // @nestjs/passport
    "@opentelemetry/api", // @opentelemetry/instrumentation-fastify
    // runtime requirements of the app's own compiled output:
    "reflect-metadata", // emitDecoratorMetadata → Reflect.* at class load
    "tslib", // tsconfig importHelpers: true
  ],
  web: [
    "@hookform/resolvers", "clsx", "date-fns", "jotai", "lucide-react",
    "next-themes", "pako", "tailwind-merge", "tw-animate-css",
  ],
};

/**
 * Overlapping deps where app and lib INTENTIONALLY diverge. Keep this list
 * painfully short and justified.
 */
const RANGE_EXCEPTIONS = {};

const problems = [];
const flag = (msg) => problems.push(msg);

/* ---------- tiny range helpers (supports ^x.y.z, >=x.y.z, exact, workspace/catalog passthrough) */
const parse = (v) => {
  const m = String(v).match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const minOf = (range) => parse(range);
const isSpecial = (r) => /^(workspace:|catalog:|npm:)/.test(String(r));
/** does `providedRange` satisfy `floorRange` (same-major for ^floors, min >= floor)? */
function providesFloor(providedRange, floorRange) {
  if (isSpecial(providedRange) || isSpecial(floorRange)) return true;
  const p = minOf(providedRange);
  const f = minOf(floorRange);
  if (!p || !f) return true; // unparseable — don't guess
  if (String(floorRange).startsWith("^") && p[0] !== f[0]) return false;
  return cmp(p, f) >= 0;
}

/* ---------- rule 1 + 2: app vs lib */
function checkAppVsLib(appName, libName) {
  const app = manifests[appName];
  const lib = manifests[libName];
  const appDeps = app.dependencies || {};
  const peers = lib.peerDependencies || {};
  const peersMeta = lib.peerDependenciesMeta || {};
  const libDeps = lib.dependencies || {};

  for (const [peer, floor] of Object.entries(peers)) {
    const optional = peersMeta[peer]?.optional === true;
    const provided = appDeps[peer];
    if (!provided) {
      if (!optional) flag(`${appName}: missing non-optional peer of ${libName}: ${peer} (floor ${floor})`);
      continue;
    }
    if (!providesFloor(provided, floor))
      flag(`${appName}: provides ${peer}@${provided} but ${libName} peer floor is ${floor}`);
  }

  for (const [dep, appRange] of Object.entries(appDeps)) {
    if (dep in peers || !(dep in libDeps)) continue;
    const allow = OVERLAP_ALLOWLIST[appName] || [];
    if (!allow.includes(dep))
      flag(`${appName}: declares ${dep} which ${libName} already owns as a dependency — remove it or allowlist with justification (scripts/check-dep-drift.js)`);
    const libRange = libDeps[dep];
    if (appRange !== libRange && !RANGE_EXCEPTIONS[`${appName}↔${libName}:${dep}`])
      flag(`${appName}↔${libName}: ${dep} ranges differ (${appRange} vs ${libRange}) — align or add a RANGE_EXCEPTION`);
  }
}
checkAppVsLib("api", "nest");
checkAppVsLib("web", "next");

/* ---------- rule 3: devDependency ranges identical across manifests */
{
  const seen = {};
  for (const [name, pkg] of Object.entries(manifests))
    for (const [dep, range] of Object.entries(pkg.devDependencies || {}))
      (seen[dep] ||= []).push([name, range]);
  for (const [dep, entries] of Object.entries(seen)) {
    if (entries.length < 2) continue;
    const ranges = new Set(entries.map(([, r]) => r));
    if (ranges.size > 1)
      flag(`devDependencies drift for ${dep}: ${entries.map(([n, r]) => `${n}:${r}`).join(", ")}`);
  }
}

/* ---------- rule 4: overrides vs declarations (directional) */
{
  const yaml = fs.readFileSync(path.join(ROOT, "pnpm-workspace.yaml"), "utf8");
  const section = yaml.split(/^overrides:/m)[1]?.split(/^\w/m)[0] || "";
  const overrides = {};
  for (const m of section.matchAll(/^  ('?)([^\s:']+)\1:\s*('?)([^'\n#]+)\3\s*$/gm))
    overrides[m[2]] = m[4].trim();
  // An override REPLACES a declared range rather than intersecting it, so an
  // override BELOW a declared floor silently resolves a version the manifest
  // says it does not support — with no peer warning. Direction matters:
  // require the override to satisfy the declared floor, not merely to be
  // comparable to it.
  for (const [dep, rawRange] of Object.entries(overrides)) {
    const oRange = resolveRange(dep, rawRange);
    for (const [name, pkg] of Object.entries(manifests)) {
      for (const sec of ["dependencies", "devDependencies"]) {
        const declared = pkg[sec]?.[dep];
        if (!declared || isSpecial(declared)) continue;
        if (!providesFloor(declared, oRange) && !providesFloor(oRange, declared))
          flag(`override ${dep}: ${oRange} contradicts ${name}.${sec} ${declared}`);
        if (!providesFloor(oRange, declared))
          flag(`override ${dep}: ${oRange} lowers ${name}.${sec} floor ${declared} — raise the override (or the catalog entry it points at)`);
      }
    }
  }
}

/* ---------- rule 5: versions.production.json */
{
  const prod = read("versions.production.json");
  const byName = {
    [manifests.nest.name]: manifests.nest.version,
    [manifests.next.name]: manifests.next.version,
    [manifests.shared.name]: manifests.shared.version,
  };
  for (const [name, pinned] of Object.entries(prod)) {
    if (!(name in byName)) flag(`versions.production.json pins unknown package ${name}`);
    else if (byName[name] !== pinned)
      flag(`versions.production.json: ${name} pinned ${pinned} but workspace version is ${byName[name]}`);
  }
}

/* ---------- report */
if (problems.length) {
  console.error(`✖ dependency drift check failed (${problems.length}):\n`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log("✓ dependency drift check passed");
