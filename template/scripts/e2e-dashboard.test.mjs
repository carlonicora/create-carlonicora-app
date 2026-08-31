/**
 * Unit tests for the pure parsers behind the e2e dashboard.
 *
 *   node --test scripts/e2e-dashboard.test.mjs
 *
 * Only the parsers are covered here — the server and page are verified by
 * actually running a scoped suite through them. The `parseStackLine` /
 * `projectLabel` cases below are pinned against the REAL files they parse
 * (scripts/e2e.sh and apps/web/playwright.config.ts), so a drift in either is
 * caught here rather than as a silently empty description column.
 * `parseCoverage` is exercised against fixture markdown only — it does not
 * read the repo's own e2e-coverage.md.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  extractIds,
  fileTitle,
  parseCoverage,
  parseStackLine,
  projectLabel,
  splitArgs,
  STACK_PHASES,
} from "./e2e-dashboard.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("extractIds handles both title conventions", () => {
  assert.deepEqual(extractIds("AUTH-32: selecting a company mints the scoped session"), ["AUTH-32"]);
  assert.deepEqual(extractIds("hub renders all five card groups with their 12 cards (ADM-01)"), ["ADM-01"]);
  assert.deepEqual(extractIds("seeded company row navigates to the detail page (ADM-04/05/08)"), [
    "ADM-04",
    "ADM-05",
    "ADM-08",
  ]);
  assert.deepEqual(extractIds("PRC-07b: a search term containing Lucene syntax returns rows"), ["PRC-07b"]);
  assert.deepEqual(extractIds("smoke /login"), []);
});

test("splitArgs honours quotes", () => {
  assert.deepEqual(splitArgs("--project=chromium-smoke"), ["--project=chromium-smoke"]);
  assert.deepEqual(splitArgs('--grep "company delete"'), ["--grep", "company delete"]);
  assert.deepEqual(splitArgs("  "), []);
  assert.deepEqual(splitArgs(undefined), []);
});

test("parseCoverage cuts the summary at the status glyph, not at the first em dash", () => {
  const entries = parseCoverage(
    [
      "#### ADM-03 · Administrator is redirected — always — to `/administration` — ✅ `spec` › \"title\"",
      "- **Given** platformAdmin is logged in",
      "- **When** they open `/dashboard`",
      "- _Seed:_ none",
      "",
      "#### COM-11 · Drag a card — 🚧 `spec` (dnd-kit)",
      "- **Given** a board",
      "## Section heading ends the entry",
      "- this line belongs to nothing",
    ].join("\n"),
  );

  const adm = entries.get("ADM-03");
  assert.equal(adm.summary, "Administrator is redirected — always — to `/administration`");
  assert.equal(adm.status, "✅");
  assert.equal(adm.detail.length, 3);

  const com = entries.get("COM-11");
  assert.equal(com.status, "🚧");
  assert.deepEqual(com.detail, ["**Given** a board"]);
});

test("parseCoverage of an empty document still carries its lookup indexes (the no-doc fallback)", () => {
  const entries = parseCoverage("");
  assert.equal(entries.size, 0);
  assert.ok(entries.byFileTitle instanceof Map, "byFileTitle index must exist");
  assert.ok(entries.byTitle instanceof Map, "byTitle index must exist");
  assert.deepEqual(entries.byFileTitle.get("x::y") ?? [], []);
});

test("parseStackLine classifies every phase e2e.sh announces", () => {
  assert.deepEqual(parseStackLine("==> [e2e] freeing test ports"), {
    type: "phase-start",
    key: "ports",
    label: "Free test ports",
    detail: "freeing test ports",
  });
  assert.equal(parseStackLine("==> [e2e] starting WORKER (db=x) — migrator").key, "worker");
  assert.equal(parseStackLine("==> [e2e] starting WEB (next start) on :4081").key, "webStart");
  assert.equal(parseStackLine("==> [e2e] building WEB (production, distDir .next-e2e)").key, "webBuild");
  assert.equal(parseStackLine("==> [e2e] waiting for http://api.{{name}}.test:4080/").key, "health");
  assert.equal(parseStackLine("==> [e2e] stack is up. running Playwright (full suite)").key, "playwright");

  assert.deepEqual(parseStackLine("==> [e2e] migrations applied — starting API + WEB"), {
    type: "phase-end",
    key: "migrations",
    ok: true,
    detail: "migrations applied — starting API + WEB",
  });
  assert.deepEqual(parseStackLine("==> [e2e] Playwright exited with code 0"), {
    type: "phase-end",
    key: "playwright",
    ok: true,
    detail: "Playwright exited with code 0",
  });
  assert.equal(parseStackLine("==> [e2e] Playwright exited with code 1").ok, false);

  assert.equal(parseStackLine("==> [e2e] building workspace packages").key, "packages");
  assert.equal(parseStackLine("==> [e2e] recreating test database x").key, "databases");
});

test("parseStackLine catches each hard boot failure", () => {
  assert.deepEqual(parseStackLine("[e2e] recreate failed"), {
    type: "phase-end",
    key: "databases",
    ok: false,
    detail: "[e2e] recreate failed",
  });
  assert.equal(parseStackLine("[e2e] FAILED: migrations not applied (see [worker] logs)").key, "migrations");
  assert.equal(parseStackLine("[e2e] web build failed").key, "webBuild");
  assert.equal(parseStackLine("[e2e] http://{{name}}.test:4081/ never came up").key, "health");
  assert.equal(parseStackLine("[e2e] workspace package build failed").key, "packages");
});

test("parseStackLine ignores ordinary sub-process output", () => {
  assert.equal(parseStackLine("[api] Nest application successfully started"), null);
  assert.equal(parseStackLine("[web-build] Compiled successfully"), null);
  assert.equal(parseStackLine(""), null);
});

test("every '==> [e2e]' line in scripts/e2e.sh maps to a phase or a note", () => {
  // Guards against e2e.sh growing a step the boot strip would silently ignore.
  const script = fs.readFileSync(path.join(ROOT, "scripts", "e2e.sh"), "utf8");
  const announced = [...script.matchAll(/^echo "==> \[e2e\] (.*)"$/gm)].map((match) => match[1]);
  assert.ok(announced.length >= 10, `expected e2e.sh to announce its phases, found ${announced.length}`);

  const unmatched = [];
  for (const raw of announced) {
    // Resolve the shell interpolations the script uses in its progress lines.
    // "0" and not a letter, because one of them ("Playwright exited with code
    // ${code}") is matched as a number.
    const line = raw.replace(/\$\{[^}]+\}/g, "0").replace(/\\"/g, '"');
    const parsed = parseStackLine(`==> [e2e] ${line}`);
    if (!parsed || parsed.type === "note") unmatched.push(line);
  }
  assert.deepEqual(unmatched, [], `e2e.sh announces phases the dashboard does not know: ${unmatched.join(" | ")}`);
});

test("no two phase patterns claim the same line", () => {
  for (const phase of STACK_PHASES) {
    const matches = STACK_PHASES.filter((other) => other.match.test(phase.match.source.replace(/^\^/, "")));
    assert.ok(matches.length <= 1, `pattern collision around ${phase.key}`);
  }
});

test("fileTitle turns a spec path into something readable", () => {
  assert.equal(fileTitle("unauthenticated/auth-guards.spec.ts"), "Auth guards");
  assert.equal(fileTitle("unauthenticated/users-api-contract.spec.ts"), "Users API contract");
  assert.equal(fileTitle("smoke/admin.smoke.spec.ts"), "Admin");
  assert.equal(fileTitle("smoke/app.smoke.spec.ts"), "App");
  assert.equal(fileTitle("pwa/service-worker.spec.ts"), "Service worker");
  assert.equal(fileTitle("support/smoke.ts"), "Route smoke checks");
  assert.equal(fileTitle("setup/seed.setup.ts"), "Seed database & log in");
});

test("projectLabel names every project in playwright.config.ts", () => {
  // Pinned against the config so a new project cannot silently show its raw id.
  const config = fs.readFileSync(path.join(ROOT, "apps", "web", "playwright.config.ts"), "utf8");
  const names = [...config.matchAll(/^\s*(?:\{\s*)?name:\s*"([^"]+)"/gm)].map((match) => match[1]);
  assert.ok(names.length >= 5, `expected the config's projects, found ${names.length}`);
  const unlabelled = names.filter((name) => projectLabel(name) === name);
  assert.deepEqual(unlabelled, [], `these projects still show their raw id: ${unlabelled.join(", ")}`);
});

test("projectLabel falls back to the raw id for an unknown project", () => {
  assert.equal(projectLabel("chromium-future"), "chromium-future");
});
