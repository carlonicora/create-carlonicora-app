# compare-template v2 (multi-target) + template-sync skill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking. **This plan uses a non-standard execution model — see "Execution Model" below. Read it before dispatching anything.**

**Goal:** Replace the single-source `sync-template.js` copier with a multi-target drift report that ranks which project most recently advanced each file, and package the judgement for reuse as an agentic skill.

**Architecture:** `scripts/compare/` holds small, pure, independently-testable ESM modules behind one orchestrator. Each has a documented contract so all of them can be written in parallel. A single `git log` pass per target repo yields per-file recency plus a `bulk` flag that demotes rename/chore commits. Classification is a pure function over content hashes and that index. The tool emits evidence (`report.md` + `report.json`); a session applies judgement using the `template-sync` skill; `template:apply` executes the chosen subset mechanically.

**Tech Stack:** Node 22 ESM, zero new dependencies. Tests are `node:test` + `node:assert/strict`, run with `node --test` — stable in Node 22.23.1, so no test framework is added.

**Spec:** `docs/superpowers/specs/2026-08-23-template-multi-source-alignment-design.md` (Phases 2 and 3)

**Predecessor:** `docs/superpowers/plans/2026-08-23-template-integrity-checks-and-repairs.md` (Plan A — built the nine-check integrity harness this plan extends and gates on)

## Global Constraints

- **Zero new npm dependencies.** Tests use `node:test`; the tool uses only `node:fs`, `node:path`, `node:child_process`, `node:crypto`.
- Node engine `>=22.0.0`; `pnpm@11.18.0` declared only at repo root.
- Everything under `scripts/` is plain ESM `.js` — no TypeScript, no build step. The repo has `"type": "module"`.
- **`src/core-update/generalizer.ts` MUST NOT be deleted or modified.** `src/core-update/patch-generator.ts`, `patch-applier.ts` and `src/commands/sync.ts` still import it. Only `scripts/sync-template.js` retires.
- **NO git commits at any point** — not in any task, not at the end. The user commits after manual verification.
- Read-only against target repos: never write to `../wyrdli`, `../neural-erp`, or any configured target.
- All nine existing integrity checks must still pass at the end (`pnpm check:template`).

---

## Execution Model — READ BEFORE DISPATCHING

This plan deviates from subagent-driven-development's default loop, at the user's explicit instruction:

1. **Tasks 1–8 are dispatched IN PARALLEL**, as independent sub-agents in a single message with multiple Agent tool calls.
2. **NO review between implementations.** Do not dispatch a task reviewer after each task.
3. **Every task writes real tests** — `node:test` files with assertions, not just command transcripts. The tests are what substitutes for per-task review.
4. **ONE review after all implementations land** (Task 10), covering the whole change at once.
5. **NO commits, ever.**

Task 9 (wiring and retirement) runs AFTER 1–8 land, because it is the only task that edits `package.json` and deleting files depends on their replacements existing. Task 10 runs last.

Because there is no per-task review, the **Shared Contracts** section below is load-bearing: it is the only thing keeping eight parallel implementers agreeing on the same interfaces. Sub-agents must implement those signatures exactly and must not invent variations.

Every sub-agent brief must include, verbatim:

> "If the plan contradicts the nja-architecture skill, the skill wins. Flag the contradiction in your hand-off summary; do not silently follow either."

Every brief must also carry the Global Constraints and: **no git command that changes state**, and **do not dispatch subagents**.

---

## Shared Contracts

Every signature below is fixed. Tasks 2–8 implement or consume them exactly.

```js
// scripts/compare/lib/generalize.js
export function generalize(content, appName)            // => string

// scripts/compare/lib/git-index.js
export function buildGitIndex(repoDir, options)         // options: { bulkThreshold = 25 }
// => Map<relPath, { date: number, subject: string, filesInCommit: number, bulk: boolean }>
//    date is a unix timestamp in SECONDS (git %ct)

// scripts/compare/lib/sources.js
export function loadSources(repoRoot)
// => { targets: Array<{ name, dir, appName, ignore: string[] }>, neverAdopt: string[], templateOnly: string[] }
export function isIgnored(relPath, patterns)            // => boolean
export function templateToAppPath(relPath)              // "gitignore" -> ".gitignore"
export function appToTemplatePath(relPath)              // ".gitignore" -> "gitignore"

// scripts/compare/lib/classify.js
export const CLASSIFICATIONS = ["ALIGNED","TARGET_AHEAD","DIVERGED","TARGET_ONLY","TEMPLATE_ONLY","NEVER_ADOPT"]
export function classifyRow(input)
// input:  { rel, inTemplate, templateBody, targets: Array<{ name, present, body, git }>, neverAdopt, templateOnly }
//         `body` is the already-generalized text, or null when absent. `git` is the git-index entry or null.
// => { rel, classification, winner, targets: Array<{ name, present, equal, date, subject, bulk }> }
//    `winner` is the target name whose version should be considered, or null.

// scripts/compare/report.js
export function renderMarkdown(rows, meta)              // => string
export function renderJson(rows, meta)                  // => object

// scripts/compare/apply.js
export function applyPaths(input)
// input: { repoRoot, target: { dir, appName }, paths: string[], dryRun = false }
// => { applied: string[], skipped: Array<{ path, reason }> }
```

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/compare/lib/generalize.js` | App-name → `{{name}}`/`{{display}}` substitution. Plain-JS port. |
| `scripts/compare/lib/git-index.js` | One `git log` pass per repo → per-file recency + bulk flag. |
| `scripts/compare/lib/sources.js` | Load/validate `template.sources.json`; ignore matching; dotfile mapping. |
| `scripts/compare/lib/classify.js` | Pure classification of one path across N targets. |
| `scripts/compare/report.js` | Render `report.md` and `report.json` from rows. |
| `scripts/compare/index.js` | Orchestrator: walk, generalize, classify, render, write. |
| `scripts/compare/apply.js` | Copy a reviewed subset from a target, re-generalizing. |
| `template.sources.json` | Declares targets, `neverAdopt`, `templateOnly`. |
| `.claude/skills/template-sync/**` | The agentic skill carrying judgement + workflow. |

Test files live beside their unit in `__tests__/`, named `<unit>.test.js`.

---

## Task 1: Inherited harness fixes from Plan A

Plan A left three must-fixes. All three live in the integrity harness and are independent of the compare tool.

**Files:**
- Modify: `scripts/integrity/index.js`
- Modify: `scripts/integrity/checks/bootstrapper-modules.js`
- Create: `scripts/integrity/__tests__/harness.test.js`

**Interfaces:** none shared — this task touches no contract.

- [ ] **Step 1: Make the runner await checks**

In `scripts/integrity/index.js`, change the invocation so an async check cannot silently misreport:

```js
    failures = await check.run({ repoRoot, templateDir, config });
```

`await` on a synchronous return value is a no-op, so all nine existing checks are unaffected. Without it, an async check returns a Promise, `failures.length` is `undefined`, the FAIL branch runs, and `for...of` throws on a non-iterable.

- [ ] **Step 2: Stop `stripComments` truncating at `://`**

In `scripts/integrity/checks/bootstrapper-modules.js`, replace the line-comment regex so a URL inside a string does not swallow the rest of the line:

```js
const stripComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // `[^:]` guards `://` — without it, any line containing "https://" is
    // truncated at the URL, and a `Modules.X` reference after it is silently
    // dropped. That is the UNDER-report direction on the one check nothing
    // else in the toolchain replaces.
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
```

- [ ] **Step 3: Widen the scan root and guard it**

Still in `bootstrapper-modules.js`: the scan root is `path.join(libDir, "src", "features")`, which misses real runtime dereferences — `src/hooks/useSocket.ts` calls `rehydrate(Modules.Notification, …)`. Widen it to `path.join(libDir, "src")`. This is only safe because Step 2's `stripComments` removes the doc-comment hits in `src/client/hooks/*` and `src/core/registry/ModuleRegistry.ts`; do Step 2 first.

Then add a `requireDir` guard, so a missing root FAILs cleanly instead of aborting the whole harness with an uncaught `ENOENT`:

```js
import { requireDir } from "../lib/require-dir.js";
```

and at the top of `run(ctx)`, after resolving `libs`:

```js
    const missing = requireDir(path.join(libDir, "src"), ctx.templateDir, "the library source root this check scans");
    if (missing.length) return missing;
```

Also guard the Bootstrapper file itself before reading it:

```js
    if (!fs.existsSync(bootstrapperPath))
      return [`expected file is missing: apps/web/src/config/Bootstrapper.ts — this check inspected nothing.`];
```

- [ ] **Step 4: Write the tests**

Create `scripts/integrity/__tests__/harness.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");

test("runner awaits check.run, so an async check reports correctly", async () => {
  const source = fs.readFileSync(path.join(repoRoot, "scripts/integrity/index.js"), "utf8");
  assert.match(
    source,
    /await\s+check\.run\(/,
    "index.js must await check.run() or an async check silently misreports",
  );
});

test("stripComments does not truncate a line at a URL's //", async () => {
  const mod = fs.readFileSync(
    path.join(repoRoot, "scripts/integrity/checks/bootstrapper-modules.js"),
    "utf8",
  );
  // The guard must be present in the line-comment regex.
  assert.match(mod, /\[\^:\]/, "line-comment regex must guard against ':' preceding '//'");
});

test("bootstrapper-modules scans the whole library src, not only src/features", async () => {
  const mod = fs.readFileSync(
    path.join(repoRoot, "scripts/integrity/checks/bootstrapper-modules.js"),
    "utf8",
  );
  assert.doesNotMatch(
    mod,
    /"src",\s*"features"/,
    'scan root must be libDir/src, not libDir/src/features — Modules.X is dereferenced outside features/',
  );
});

test("bootstrapper-modules guards its roots instead of throwing ENOENT", async () => {
  const mod = fs.readFileSync(
    path.join(repoRoot, "scripts/integrity/checks/bootstrapper-modules.js"),
    "utf8",
  );
  assert.match(mod, /requireDir/, "must use requireDir so a missing root FAILs rather than aborting the run");
});
```

- [ ] **Step 5: Run the tests**

Run: `node --test scripts/integrity/__tests__/harness.test.js`
Expected: 4 passing.

- [ ] **Step 6: Confirm no regression**

Run: `pnpm check:template`
Expected: all nine checks PASS. If `bootstrapper-modules` now reports names it did not before, that is Step 3 working — report the names rather than registering them; a later task or the user decides.

---

## Task 2: `generalize.js`

**Files:**
- Create: `scripts/compare/lib/generalize.js`
- Create: `scripts/compare/lib/__tests__/generalize.test.js`

**Interfaces:**
- Produces: `generalize(content, appName) => string`. Tasks 7 and 8 consume it.

> `src/core-update/generalizer.ts` stays exactly as it is — `src/core-update/patch-generator.ts`, `patch-applier.ts` and `src/commands/sync.ts` import it. This is a plain-JS port for the `scripts/` toolchain, not a replacement. Note the relationship in a comment.

- [ ] **Step 1: Write the module**

Create `scripts/compare/lib/generalize.js`:

```js
/**
 * Replace an app's own identifiers with the scaffolder's placeholders.
 *
 * `{{name}}` is the kebab-case project name ("my-app"); `{{display}}` is the
 * human-readable one ("My App"). They are DIFFERENT values — src/replacer.ts
 * substitutes each separately at scaffold time, so mixing them inside one
 * rendered file produces visibly inconsistent output.
 *
 * A plain-JS port of src/core-update/generalizer.ts, which stays in place for
 * the core-update feature. Keep the two in step if either changes.
 */

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Highest priority first: the most specific patterns must win. */
function patternsFor(appName) {
  const a = appName;
  return [
    [`${a}-api`, "{{name}}-api"],
    [`${a}-web`, "{{name}}-web"],
    [`@${a}/shared`, "@{{name}}/shared"],
    [`api.${a}.test`, "api.{{name}}.test"],
    [`minio.${a}.test`, "minio.{{name}}.test"],
    [`${a}.test`, "{{name}}.test"],
    [`admin@${a}.com`, "admin@{{name}}.com"],
    [`info@${a}.com`, "info@{{name}}.com"],
    [`${a}_SECRET`, "{{name}}_SECRET"],
    [`NEO4J_DATABASE=${a}`, "NEO4J_DATABASE={{name}}"],
    [`REDIS_QUEUE=${a}`, "REDIS_QUEUE={{name}}"],
    [`${a}-web#build`, "{{name}}-web#build"],
    [`/${a}-logo`, "/{{name}}-logo"],
    [`${a}-logo`, "{{name}}-logo"],
  ];
}

export function generalize(content, appName) {
  if (!appName) throw new TypeError("generalize requires an appName");
  let result = content;
  for (const [search, replace] of patternsFor(appName)) {
    result = result.split(search).join(replace);
  }
  // Word-boundary fallback, case-insensitive: catches bare occurrences the
  // specific patterns missed. Runs LAST so it cannot pre-empt them.
  return result.replace(new RegExp(`\\b${escapeRegExp(appName)}\\b`, "gi"), "{{name}}");
}
```

- [ ] **Step 2: Write the tests**

Create `scripts/compare/lib/__tests__/generalize.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { generalize } from "../generalize.js";

test("specific patterns beat the word-boundary fallback", () => {
  assert.equal(generalize("wyrdli-api", "wyrdli"), "{{name}}-api");
  assert.equal(generalize("@wyrdli/shared", "wyrdli"), "@{{name}}/shared");
  assert.equal(generalize("api.wyrdli.test", "wyrdli"), "api.{{name}}.test");
});

test("bare occurrences fall back to {{name}}", () => {
  assert.equal(generalize("welcome to wyrdli", "wyrdli"), "welcome to {{name}}");
});

test("fallback is case-insensitive", () => {
  assert.equal(generalize("Wyrdli", "wyrdli"), "{{name}}");
});

test("does not touch unrelated words containing the app name", () => {
  // \b prevents a substring match inside a longer identifier.
  assert.equal(generalize("wyrdlicious", "wyrdli"), "wyrdlicious");
});

test("handles a hyphenated app name without regex breakage", () => {
  assert.equal(generalize("neural-erp-web", "neural-erp"), "{{name}}-web");
  assert.equal(generalize("a neural-erp thing", "neural-erp"), "a {{name}} thing");
});

test("is a no-op when the app name does not occur", () => {
  assert.equal(generalize("nothing to see", "wyrdli"), "nothing to see");
});

test("throws rather than silently mangling when appName is empty", () => {
  assert.throws(() => generalize("x", ""), TypeError);
});
```

- [ ] **Step 3: Run the tests**

Run: `node --test scripts/compare/lib/__tests__/generalize.test.js`
Expected: 7 passing.

---

## Task 3: `git-index.js`

**Files:**
- Create: `scripts/compare/lib/git-index.js`
- Create: `scripts/compare/lib/__tests__/git-index.test.js`

**Interfaces:**
- Produces: `buildGitIndex(repoDir, { bulkThreshold = 25 })` → `Map<relPath, { date, subject, filesInCommit, bulk }>`. Tasks 5 and 7 consume it.

- [ ] **Step 1: Write the module**

Create `scripts/compare/lib/git-index.js`:

```js
import { execFileSync } from "node:child_process";

/**
 * Per-file recency for a whole repo, in ONE git pass.
 *
 * `bulk` is the point of this module. A file's last-commit date says WHEN it
 * was touched, not WHAT advanced. Rename sweeps and dependency chores touch
 * hundreds of files and make every one of them look freshly authored — which
 * is exactly how a project that DELETED a feature can appear to be the one
 * that most recently improved it. A commit touching more than `bulkThreshold`
 * files marks its files `bulk: true`, and consumers demote that recency to a
 * weak hint.
 *
 * Only the FIRST (most recent) commit touching a path is recorded; git log
 * yields commits newest-first.
 */
export function buildGitIndex(repoDir, options = {}) {
  const bulkThreshold = options.bulkThreshold ?? 25;
  const index = new Map();

  const raw = execFileSync(
    "git",
    ["log", "--no-merges", "--format=C|%ct|%s", "--name-only"],
    { cwd: repoDir, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );

  let date = 0;
  let subject = "";
  let pending = [];

  const flush = () => {
    if (pending.length === 0) return;
    const filesInCommit = pending.length;
    const bulk = filesInCommit > bulkThreshold;
    for (const rel of pending) {
      // newest wins: git log is newest-first, so never overwrite.
      if (!index.has(rel)) index.set(rel, { date, subject, filesInCommit, bulk });
    }
    pending = [];
  };

  for (const line of raw.split("\n")) {
    if (line.startsWith("C|")) {
      flush();
      const rest = line.slice(2);
      const sep = rest.indexOf("|");
      date = Number(rest.slice(0, sep));
      subject = rest.slice(sep + 1);
      continue;
    }
    if (line.trim() === "") continue;
    pending.push(line);
  }
  flush();

  return index;
}
```

- [ ] **Step 2: Write the tests**

Create `scripts/compare/lib/__tests__/git-index.test.js`. These build a throwaway repo in `node:os.tmpdir()` so they are hermetic — they never touch a real target repo:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { buildGitIndex } from "../git-index.js";

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gitindex-"));
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: dir,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "t",
        GIT_AUTHOR_EMAIL: "t@example.com",
        GIT_COMMITTER_NAME: "t",
        GIT_COMMITTER_EMAIL: "t@example.com",
      },
    });
  git("init", "-q");
  return { dir, git };
}

function commit(repo, files, message) {
  for (const [name, body] of Object.entries(files)) {
    const full = path.join(repo.dir, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  repo.git("add", "-A");
  repo.git("commit", "-q", "-m", message);
}

test("records the most recent commit per file", () => {
  const repo = makeRepo();
  commit(repo, { "a.txt": "1" }, "first");
  commit(repo, { "a.txt": "2" }, "second");
  const index = buildGitIndex(repo.dir);
  assert.equal(index.get("a.txt").subject, "second", "newest commit must win");
});

test("files from different commits keep their own subjects", () => {
  const repo = makeRepo();
  commit(repo, { "a.txt": "1" }, "touch a");
  commit(repo, { "b.txt": "1" }, "touch b");
  const index = buildGitIndex(repo.dir);
  assert.equal(index.get("a.txt").subject, "touch a");
  assert.equal(index.get("b.txt").subject, "touch b");
});

test("a commit over the threshold marks its files bulk", () => {
  const repo = makeRepo();
  const many = {};
  for (let i = 0; i < 30; i++) many[`f${i}.txt`] = "x";
  commit(repo, many, "big sweep");
  const index = buildGitIndex(repo.dir, { bulkThreshold: 25 });
  assert.equal(index.get("f0.txt").bulk, true);
  assert.equal(index.get("f0.txt").filesInCommit, 30);
});

test("a small commit is not bulk", () => {
  const repo = makeRepo();
  commit(repo, { "a.txt": "1", "b.txt": "1" }, "small");
  const index = buildGitIndex(repo.dir, { bulkThreshold: 25 });
  assert.equal(index.get("a.txt").bulk, false);
});

test("bulkThreshold is configurable", () => {
  const repo = makeRepo();
  commit(repo, { "a.txt": "1", "b.txt": "1", "c.txt": "1" }, "three");
  assert.equal(buildGitIndex(repo.dir, { bulkThreshold: 2 }).get("a.txt").bulk, true);
  assert.equal(buildGitIndex(repo.dir, { bulkThreshold: 5 }).get("a.txt").bulk, false);
});

test("subjects containing a pipe survive parsing", () => {
  const repo = makeRepo();
  commit(repo, { "a.txt": "1" }, "fix: a|b pipe in subject");
  assert.equal(buildGitIndex(repo.dir).get("a.txt").subject, "fix: a|b pipe in subject");
});

test("nested paths are recorded with forward slashes", () => {
  const repo = makeRepo();
  commit(repo, { "src/deep/x.ts": "1" }, "nested");
  assert.ok(buildGitIndex(repo.dir).has("src/deep/x.ts"));
});

test("date is a unix timestamp in seconds", () => {
  const repo = makeRepo();
  commit(repo, { "a.txt": "1" }, "one");
  const { date } = buildGitIndex(repo.dir).get("a.txt");
  assert.equal(Number.isInteger(date), true);
  assert.ok(date > 1_000_000_000 && date < 10_000_000_000, "should be seconds, not milliseconds");
});
```

- [ ] **Step 3: Run the tests**

Run: `node --test scripts/compare/lib/__tests__/git-index.test.js`
Expected: 8 passing.

---

## Task 4: `sources.js`

**Files:**
- Create: `scripts/compare/lib/sources.js`
- Create: `scripts/compare/lib/__tests__/sources.test.js`

**Interfaces:**
- Produces: `loadSources`, `isIgnored`, `templateToAppPath`, `appToTemplatePath`. Tasks 7 and 8 consume them.

> `template.sources.json` itself is created by Task 7. `loadSources` must throw a clear error when it is absent — do not create the file here.

- [ ] **Step 1: Write the module**

Create `scripts/compare/lib/sources.js`:

```js
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
    return { name: entry.name, dir, appName: entry.appName, ignore: entry.ignore ?? [] };
  });

  return { targets, neverAdopt: parsed.neverAdopt ?? [], templateOnly: parsed.templateOnly ?? [] };
}
```

- [ ] **Step 2: Write the tests**

Create `scripts/compare/lib/__tests__/sources.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadSources, isIgnored, templateToAppPath, appToTemplatePath } from "../sources.js";

test("dotfile mapping round-trips at the repo root", () => {
  assert.equal(templateToAppPath("gitignore"), ".gitignore");
  assert.equal(appToTemplatePath(".gitignore"), "gitignore");
});

test("dotfile mapping applies to nested paths and keeps the directory", () => {
  assert.equal(templateToAppPath("apps/web/swcrc"), "apps/web/.swcrc");
  assert.equal(appToTemplatePath("apps/web/.swcrc"), "apps/web/swcrc");
});

test("non-dotfiles pass through untouched", () => {
  assert.equal(templateToAppPath("apps/web/package.json"), "apps/web/package.json");
});

test("a wildcard-free pattern ignores the whole subtree", () => {
  assert.equal(isIgnored("apps/api/src", ["apps/api/src"]), true);
  assert.equal(isIgnored("apps/api/src/main.ts", ["apps/api/src"]), true);
  assert.equal(isIgnored("apps/api/srcs/main.ts", ["apps/api/src"]), false, "must not match a sibling prefix");
});

test("* does not span a separator but ** does", () => {
  assert.equal(isIgnored("apps/web/a.ts", ["apps/*/a.ts"]), true);
  assert.equal(isIgnored("apps/web/deep/a.ts", ["apps/*/a.ts"]), false);
  assert.equal(isIgnored("apps/web/deep/a.ts", ["apps/**/a.ts"]), true);
});

test("no patterns means nothing is ignored", () => {
  assert.equal(isIgnored("anything", []), false);
  assert.equal(isIgnored("anything", undefined), false);
});

test("loadSources throws a clear error when the config is absent", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sources-"));
  assert.throws(() => loadSources(dir), /template\.sources\.json not found/);
});

test("loadSources throws when a target directory does not exist", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sources-"));
  fs.writeFileSync(
    path.join(dir, "template.sources.json"),
    JSON.stringify({ targets: [{ name: "ghost", path: "../nope", appName: "ghost" }] }),
  );
  assert.throws(() => loadSources(dir), /not found at/);
});

test("loadSources throws when a target is missing a required field", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sources-"));
  fs.writeFileSync(
    path.join(dir, "template.sources.json"),
    JSON.stringify({ targets: [{ name: "x", path: "." }] }),
  );
  assert.throws(() => loadSources(dir), /missing required field "appName"/);
});

test("loadSources resolves a valid target and defaults the optional lists", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sources-"));
  fs.mkdirSync(path.join(dir, "sibling"));
  fs.writeFileSync(
    path.join(dir, "template.sources.json"),
    JSON.stringify({ targets: [{ name: "sib", path: "./sibling", appName: "sib" }] }),
  );
  const loaded = loadSources(dir);
  assert.equal(loaded.targets.length, 1);
  assert.equal(loaded.targets[0].appName, "sib");
  assert.deepEqual(loaded.neverAdopt, []);
  assert.deepEqual(loaded.templateOnly, []);
});
```

- [ ] **Step 3: Run the tests**

Run: `node --test scripts/compare/lib/__tests__/sources.test.js`
Expected: 10 passing.

---

## Task 5: `classify.js`

**Files:**
- Create: `scripts/compare/lib/classify.js`
- Create: `scripts/compare/lib/__tests__/classify.test.js`

**Interfaces:**
- Produces: `CLASSIFICATIONS`, `classifyRow(input) => Row`. Tasks 6 and 7 consume them.

This is a pure function — no filesystem, no git. That is deliberate: it is the piece carrying the judgement policy, so it must be exhaustively testable in isolation.

- [ ] **Step 1: Write the module**

Create `scripts/compare/lib/classify.js`:

```js
export const CLASSIFICATIONS = [
  "ALIGNED",
  "TARGET_AHEAD",
  "DIVERGED",
  "TARGET_ONLY",
  "TEMPLATE_ONLY",
  "NEVER_ADOPT",
];

/**
 * Classify one path across N targets.
 *
 * The `winner` is a RANKED HINT, never a decision. Recency is confounded by
 * bulk commits, so a non-bulk target always outranks a bulk one even when the
 * bulk one is newer — that single rule is what stops a rename sweep from
 * looking like the most recent improvement. Where every candidate is bulk, the
 * newest wins but the row still carries `bulk: true` for every target so a
 * reader can see the hint is weak.
 *
 * A row is only ever a hint plus evidence. Nothing here adopts anything.
 */
export function classifyRow(input) {
  const { rel, inTemplate, templateBody, targets, neverAdopt = [], templateOnly = [] } = input;

  const summarised = targets.map((t) => ({
    name: t.name,
    present: t.present,
    equal: t.present && inTemplate ? t.body === templateBody : false,
    date: t.git?.date ?? null,
    subject: t.git?.subject ?? null,
    bulk: t.git?.bulk ?? false,
  }));

  const matches = (patterns) => patterns.some((p) => rel === p || rel.startsWith(`${p}/`));

  const row = { rel, classification: null, winner: null, targets: summarised };

  if (matches(neverAdopt)) {
    row.classification = "NEVER_ADOPT";
    return row;
  }

  const present = summarised.filter((t) => t.present);

  if (!inTemplate) {
    row.classification = present.length > 0 ? "TARGET_ONLY" : "TEMPLATE_ONLY";
    row.winner = present.length > 0 ? pickWinner(present) : null;
    return row;
  }

  if (present.length === 0 || matches(templateOnly)) {
    row.classification = "TEMPLATE_ONLY";
    return row;
  }

  if (present.every((t) => t.equal)) {
    row.classification = "ALIGNED";
    return row;
  }

  const differing = present.filter((t) => !t.equal);
  // One target differs while every other present target matches the template:
  // a single candidate to consider. More than one differing version means the
  // three-way disagreement a human has to resolve.
  row.classification = differing.length === 1 ? "TARGET_AHEAD" : "DIVERGED";
  row.winner = pickWinner(differing);
  return row;
}

/** Non-bulk beats bulk; then newest wins. */
function pickWinner(candidates) {
  const ranked = [...candidates].sort((a, b) => {
    if (a.bulk !== b.bulk) return a.bulk ? 1 : -1;
    return (b.date ?? 0) - (a.date ?? 0);
  });
  return ranked[0]?.name ?? null;
}
```

- [ ] **Step 2: Write the tests**

Create `scripts/compare/lib/__tests__/classify.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyRow, CLASSIFICATIONS } from "../classify.js";

const target = (name, body, { date = 1000, subject = "s", bulk = false } = {}) => ({
  name,
  present: body !== null,
  body,
  git: body === null ? null : { date, subject, bulk },
});

const base = { rel: "a.ts", inTemplate: true, templateBody: "T", neverAdopt: [], templateOnly: [] };

test("every classification is a known constant", () => {
  const row = classifyRow({ ...base, targets: [target("w", "T")] });
  assert.ok(CLASSIFICATIONS.includes(row.classification));
});

test("all present targets equal to the template is ALIGNED", () => {
  const row = classifyRow({ ...base, targets: [target("w", "T"), target("n", "T")] });
  assert.equal(row.classification, "ALIGNED");
  assert.equal(row.winner, null);
});

test("exactly one differing target is TARGET_AHEAD and names the winner", () => {
  const row = classifyRow({ ...base, targets: [target("w", "X"), target("n", "T")] });
  assert.equal(row.classification, "TARGET_AHEAD");
  assert.equal(row.winner, "w");
});

test("two differing targets is DIVERGED", () => {
  const row = classifyRow({ ...base, targets: [target("w", "X"), target("n", "Y")] });
  assert.equal(row.classification, "DIVERGED");
});

test("absent from the template but present in a target is TARGET_ONLY", () => {
  const row = classifyRow({ ...base, inTemplate: false, templateBody: null, targets: [target("w", "X")] });
  assert.equal(row.classification, "TARGET_ONLY");
  assert.equal(row.winner, "w");
});

test("present in the template and no target is TEMPLATE_ONLY", () => {
  const row = classifyRow({ ...base, targets: [target("w", null)] });
  assert.equal(row.classification, "TEMPLATE_ONLY");
});

test("an explicit templateOnly path stays TEMPLATE_ONLY even when a target has it", () => {
  const row = classifyRow({ ...base, templateOnly: ["a.ts"], targets: [target("w", "X")] });
  assert.equal(row.classification, "TEMPLATE_ONLY");
});

test("neverAdopt wins over everything, including a differing target", () => {
  const row = classifyRow({ ...base, neverAdopt: ["a.ts"], targets: [target("w", "X")] });
  assert.equal(row.classification, "NEVER_ADOPT");
});

test("neverAdopt matches a whole subtree by prefix", () => {
  const row = classifyRow({
    ...base,
    rel: "apps/api/src/neo4j.migrations/001.ts",
    neverAdopt: ["apps/api/src/neo4j.migrations"],
    targets: [target("w", "X")],
  });
  assert.equal(row.classification, "NEVER_ADOPT");
});

test("a non-bulk target outranks a NEWER bulk one", () => {
  // This is the rule the whole design turns on: a rename sweep that touched
  // the file yesterday must not beat a real edit from last week.
  const row = classifyRow({
    ...base,
    targets: [
      target("bulky", "X", { date: 9999, bulk: true, subject: "chore: rename everything" }),
      target("real", "Y", { date: 1000, bulk: false, subject: "feat: actually change it" }),
    ],
  });
  assert.equal(row.classification, "DIVERGED");
  assert.equal(row.winner, "real", "non-bulk must outrank a newer bulk commit");
});

test("when every candidate is bulk the newest wins but the flag is preserved", () => {
  const row = classifyRow({
    ...base,
    targets: [
      target("older", "X", { date: 1000, bulk: true }),
      target("newer", "Y", { date: 5000, bulk: true }),
    ],
  });
  assert.equal(row.winner, "newer");
  assert.equal(row.targets.every((t) => t.bulk), true, "bulk must stay visible so the hint reads as weak");
});

test("row always carries every target, present or not", () => {
  const row = classifyRow({ ...base, targets: [target("w", "X"), target("n", null)] });
  assert.equal(row.targets.length, 2);
  assert.equal(row.targets.find((t) => t.name === "n").present, false);
});
```

- [ ] **Step 3: Run the tests**

Run: `node --test scripts/compare/lib/__tests__/classify.test.js`
Expected: 12 passing.

---

## Task 6: `report.js`

**Files:**
- Create: `scripts/compare/report.js`
- Create: `scripts/compare/__tests__/report.test.js`

**Interfaces:**
- Consumes: the `Row` shape from `classify.js` (Task 5) — see Shared Contracts. Do not import `classify.js`; take rows as input.
- Produces: `renderMarkdown(rows, meta) => string`, `renderJson(rows, meta) => object`. Task 7 consumes them.

- [ ] **Step 1: Write the module**

Create `scripts/compare/report.js`:

```js
const ORDER = ["DIVERGED", "TARGET_AHEAD", "TARGET_ONLY", "TEMPLATE_ONLY", "NEVER_ADOPT", "ALIGNED"];

const isoDay = (seconds) => (seconds ? new Date(seconds * 1000).toISOString().slice(0, 10) : "—");

/**
 * Rows are grouped with the ones needing judgement FIRST and ALIGNED last.
 * A report that opens with hundreds of unchanged files buries the handful that
 * actually need a decision, and an unread report is the same as no report.
 */
export function renderMarkdown(rows, meta = {}) {
  const grouped = new Map(ORDER.map((k) => [k, []]));
  for (const row of rows) (grouped.get(row.classification) ?? []).push(row);

  const out = [];
  out.push("# Template drift report");
  out.push("");
  if (meta.generatedAt) out.push(`**Generated:** ${meta.generatedAt}`);
  out.push(`**Targets:** ${(meta.targets ?? []).join(", ") || "—"}`);
  out.push(`**Files compared:** ${rows.length}`);
  out.push("");
  out.push("| Classification | Count |");
  out.push("|---|---|");
  for (const key of ORDER) out.push(`| ${key} | ${grouped.get(key).length} |`);
  out.push("");
  out.push(
    "> `winner` is a ranked HINT, not a decision. A non-bulk commit outranks a newer bulk one, " +
      "because a rename sweep touches a file without advancing it. Judgement is the reader's.",
  );

  for (const key of ORDER) {
    const group = grouped.get(key);
    if (group.length === 0) continue;
    out.push("");
    out.push(`## ${key} (${group.length})`);
    out.push("");
    out.push("| Path | Winner | Targets |");
    out.push("|---|---|---|");
    for (const row of group) {
      const cells = row.targets
        .map((t) => {
          if (!t.present) return `${t.name}: absent`;
          const state = t.equal ? "same" : "differs";
          return `${t.name}: ${state}, ${isoDay(t.date)}${t.bulk ? " (bulk)" : ""}`;
        })
        .join("<br>");
      out.push(`| \`${row.rel}\` | ${row.winner ?? "—"} | ${cells} |`);
    }
  }
  out.push("");
  return out.join("\n");
}

export function renderJson(rows, meta = {}) {
  const counts = Object.fromEntries(ORDER.map((k) => [k, 0]));
  for (const row of rows) if (counts[row.classification] !== undefined) counts[row.classification]++;
  return { meta: { ...meta, total: rows.length, counts }, rows };
}
```

- [ ] **Step 2: Write the tests**

Create `scripts/compare/__tests__/report.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown, renderJson } from "../report.js";

const row = (rel, classification, targets, winner = null) => ({ rel, classification, winner, targets });
const t = (name, { present = true, equal = false, date = 1755000000, bulk = false } = {}) => ({
  name,
  present,
  equal,
  date,
  subject: "s",
  bulk,
});

test("markdown lists judgement-needed groups before ALIGNED", () => {
  const md = renderMarkdown([
    row("a", "ALIGNED", [t("w", { equal: true })]),
    row("b", "DIVERGED", [t("w"), t("n")]),
  ]);
  assert.ok(md.indexOf("## DIVERGED") < md.indexOf("## ALIGNED"), "DIVERGED must precede ALIGNED");
});

test("markdown omits empty groups", () => {
  const md = renderMarkdown([row("a", "ALIGNED", [t("w", { equal: true })])]);
  assert.doesNotMatch(md, /## DIVERGED/);
});

test("markdown marks a bulk target so the hint reads as weak", () => {
  const md = renderMarkdown([row("a", "TARGET_AHEAD", [t("w", { bulk: true })], "w")]);
  assert.match(md, /\(bulk\)/);
});

test("markdown shows an absent target explicitly", () => {
  const md = renderMarkdown([row("a", "TEMPLATE_ONLY", [t("w", { present: false })])]);
  assert.match(md, /w: absent/);
});

test("markdown renders a date as an ISO day and handles a null date", () => {
  const md = renderMarkdown([row("a", "TARGET_AHEAD", [{ ...t("w"), date: null }], "w")]);
  assert.match(md, /—/);
});

test("markdown states that winner is a hint, not a decision", () => {
  const md = renderMarkdown([row("a", "ALIGNED", [t("w", { equal: true })])]);
  assert.match(md, /hint/i);
});

test("json carries per-classification counts and the rows", () => {
  const rows = [row("a", "ALIGNED", [t("w", { equal: true })]), row("b", "DIVERGED", [t("w"), t("n")])];
  const json = renderJson(rows, { targets: ["w", "n"] });
  assert.equal(json.meta.total, 2);
  assert.equal(json.meta.counts.ALIGNED, 1);
  assert.equal(json.meta.counts.DIVERGED, 1);
  assert.equal(json.rows.length, 2);
});

test("json is serialisable", () => {
  const json = renderJson([row("a", "ALIGNED", [t("w", { equal: true })])], {});
  assert.doesNotThrow(() => JSON.stringify(json));
});

test("empty input produces a valid report rather than throwing", () => {
  assert.doesNotThrow(() => renderMarkdown([]));
  assert.equal(renderJson([]).meta.total, 0);
});
```

- [ ] **Step 3: Run the tests**

Run: `node --test scripts/compare/__tests__/report.test.js`
Expected: 9 passing.

---

## Task 7: Orchestrator + `template.sources.json`

**Files:**
- Create: `scripts/compare/index.js`
- Create: `template.sources.json`
- Create: `scripts/compare/__tests__/index.test.js`

**Interfaces:**
- Consumes: `generalize` (Task 2), `buildGitIndex` (Task 3), `loadSources`/`isIgnored`/`appToTemplatePath` (Task 4), `classifyRow` (Task 5), `renderMarkdown`/`renderJson` (Task 6). All per Shared Contracts.
- Produces: `compareTemplate({ repoRoot, outDir })` → `{ rows, markdown, json }`.

> Your tests exercise the real sibling modules, so they will fail until Tasks 2–6 land. That is expected under this plan's parallel model — Task 10 runs the full suite. Write them correctly against the contracts; do not stub the siblings.

- [ ] **Step 1: Write the config**

Create `template.sources.json` at the repo root:

```json
{
  "targets": [
    {
      "name": "wyrdli",
      "path": "../wyrdli",
      "appName": "wyrdli",
      "ignore": [
        "apps/web/src/features/features",
        "apps/web/src/features/marketing",
        "apps/web/src/app/[locale]/(main)/(features)",
        "apps/web/src/app/[locale]/(marketing)",
        "apps/api/src/features",
        "apps/api/src/config/prompts",
        "apps/api/scripts",
        "packages/shared/src/calendar",
        "packages/shared/src/game-system",
        "packages/shared/src/index.ts",
        "packages/shared/src/const/modules.id.ts",
        "docs",
        "migrations",
        ".impeccable",
        "DESIGN.md",
        "PRODUCT.md",
        "PLAYER_HANDBOOK.md"
      ]
    },
    {
      "name": "neural-erp",
      "path": "../neural-erp",
      "appName": "neural-erp",
      "ignore": [
        "apps/web/src/app/[locale]/(main)/(features)",
        "apps/api/src/features",
        "apps/api/src/scripts",
        "packages/shared/src/const",
        "packages/shared/src/money",
        "packages/shared/src/pricing",
        "packages/shared/src/invoice",
        "packages/shared/src/schemas",
        "packages/shared/src/index.ts",
        "openspec",
        "docs",
        "migrations",
        "structure"
      ]
    }
  ],
  "neverAdopt": [
    "apps/api/src/neo4j.migrations",
    "apps/api/src/config/config.ts",
    "apps/api/src/config/interfaces/config.interface.ts",
    "packages/shared/src/index.ts",
    "packages/shared/src/const/module.id.ts",
    "package.json",
    "pnpm-lock.yaml"
  ],
  "templateOnly": [
    "apps/web/src/features/pwa",
    "apps/web/src/features/onboarding",
    "apps/web/src/features/essentials",
    "apps/web/src/app/[locale]/(auth)/oauth",
    "apps/web/src/app/[locale]/(admin)/administration/waitlist",
    "apps/web/src/config/waitlist.config.ts",
    "apps/api/src/features/essentials",
    "apps/api/src/rbac",
    "apps/api/src/openapi",
    "apps/api/scripts",
    "scripts/integrity",
    "scripts/compare",
    "template.sources.json",
    "integrity.config.json"
  ]
}
```

The `neverAdopt` entries carry hard-won rationale: `neo4j.migrations` because wyrdli and the template use **different bootstrap schemes** (not drift); `config.ts`/`config.interface.ts` because each app extends them with app-specific fields; `packages/shared/src/index.ts` and `const/module.id.ts` because wyrdli's `ModuleId` holds campaign-entity UUIDs while the template's holds RBAC module UUIDs — same symbol, different meaning.

- [ ] **Step 2: Write the orchestrator**

Create `scripts/compare/index.js`:

```js
import fs from "node:fs";
import path from "node:path";
import { generalize } from "./lib/generalize.js";
import { buildGitIndex } from "./lib/git-index.js";
import { loadSources, isIgnored, appToTemplatePath, templateToAppPath } from "./lib/sources.js";
import { classifyRow } from "./lib/classify.js";
import { renderMarkdown, renderJson } from "./report.js";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".next", ".turbo", "coverage", ".worktrees"]);
const BINARY = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg", ".woff", ".woff2",
  ".ttf", ".eot", ".otf", ".pdf", ".zip", ".gz", ".lock", ".onnx",
]);

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

const readText = (file) => {
  if (BINARY.has(path.extname(file).toLowerCase())) return null;
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
};

/** Whitespace-insensitive so pure reformatting does not read as a real change. */
const normalise = (text) => (text === null ? null : text.replace(/\s+/g, " ").trim());

export function compareTemplate({ repoRoot, outDir = repoRoot }) {
  const { targets, neverAdopt, templateOnly } = loadSources(repoRoot);
  const templateDir = path.join(repoRoot, "template");

  const gitIndexes = new Map(targets.map((t) => [t.name, buildGitIndex(t.dir)]));

  const templatePaths = walk(templateDir).filter((rel) => !rel.includes(".DS_Store"));
  const seen = new Set(templatePaths);

  // Target-only candidates: anything a target has that the template does not,
  // minus that target's ignore list.
  for (const target of targets) {
    for (const appRel of walk(target.dir)) {
      if (isIgnored(appRel, target.ignore)) continue;
      const rel = appToTemplatePath(appRel);
      if (!seen.has(rel)) seen.add(rel);
    }
  }

  const rows = [];
  for (const rel of [...seen].sort()) {
    const templateFile = path.join(templateDir, rel);
    const inTemplate = fs.existsSync(templateFile);
    const templateBody = inTemplate ? normalise(readText(templateFile)) : null;

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

      const raw = readText(file.full);
      return {
        name: target.name,
        present: true,
        body: raw === null ? null : normalise(generalize(raw, target.appName)),
        git: gitIndexes.get(target.name).get(file.rel) ?? null,
      };
    });

    rows.push(classifyRow({ rel, inTemplate, templateBody, targets: rowTargets, neverAdopt, templateOnly }));
  }

  const meta = { targets: targets.map((t) => t.name) };
  const markdown = renderMarkdown(rows, meta);
  const json = renderJson(rows, meta);

  fs.writeFileSync(path.join(outDir, "template-drift-report.md"), markdown, "utf8");
  fs.writeFileSync(path.join(outDir, "template-drift-report.json"), JSON.stringify(json, null, 2), "utf8");

  return { rows, markdown, json };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
  const { rows, json } = compareTemplate({ repoRoot });
  for (const [key, count] of Object.entries(json.meta.counts)) console.log(`${key.padEnd(14)} ${count}`);
  console.log(`\n${rows.length} paths compared. Reports written to template-drift-report.{md,json}`);
}
```

- [ ] **Step 3: Write the tests**

Create `scripts/compare/__tests__/index.test.js`. Build a miniature repo-plus-targets in a temp dir so the test is hermetic:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { compareTemplate } from "../index.js";

function write(file, body) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

function gitRepo(dir, files, message) {
  fs.mkdirSync(dir, { recursive: true });
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@e.com",
    GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@e.com",
  };
  execFileSync("git", ["init", "-q"], { cwd: dir, env });
  for (const [rel, body] of Object.entries(files)) write(path.join(dir, rel), body);
  execFileSync("git", ["add", "-A"], { cwd: dir, env });
  execFileSync("git", ["commit", "-q", "-m", message], { cwd: dir, env });
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cmp-"));
  const repoRoot = path.join(root, "bootstrapper");
  write(path.join(repoRoot, "template/shared.ts"), "same");
  write(path.join(repoRoot, "template/drifted.ts"), "template version");
  write(path.join(repoRoot, "template/only-here.ts"), "template exclusive");

  gitRepo(path.join(root, "alpha"), { "shared.ts": "same", "drifted.ts": "alpha version", "new.ts": "alpha new" }, "alpha");
  gitRepo(path.join(root, "beta"), { "shared.ts": "same", "drifted.ts": "template version" }, "beta");

  write(
    path.join(repoRoot, "template.sources.json"),
    JSON.stringify({
      targets: [
        { name: "alpha", path: "../alpha", appName: "alpha" },
        { name: "beta", path: "../beta", appName: "beta" },
      ],
      neverAdopt: [],
      templateOnly: [],
    }),
  );
  return repoRoot;
}

const find = (rows, rel) => rows.find((r) => r.rel === rel);

test("a file identical everywhere is ALIGNED", () => {
  const { rows } = compareTemplate({ repoRoot: fixture() });
  assert.equal(find(rows, "shared.ts").classification, "ALIGNED");
});

test("one target differing is TARGET_AHEAD and names it", () => {
  const { rows } = compareTemplate({ repoRoot: fixture() });
  const row = find(rows, "drifted.ts");
  assert.equal(row.classification, "TARGET_AHEAD");
  assert.equal(row.winner, "alpha");
});

test("a file only a target has is TARGET_ONLY", () => {
  const { rows } = compareTemplate({ repoRoot: fixture() });
  assert.equal(find(rows, "new.ts").classification, "TARGET_ONLY");
});

test("a file only the template has is TEMPLATE_ONLY", () => {
  const { rows } = compareTemplate({ repoRoot: fixture() });
  assert.equal(find(rows, "only-here.ts").classification, "TEMPLATE_ONLY");
});

test("both report files are written", () => {
  const repoRoot = fixture();
  compareTemplate({ repoRoot });
  assert.ok(fs.existsSync(path.join(repoRoot, "template-drift-report.md")));
  assert.ok(fs.existsSync(path.join(repoRoot, "template-drift-report.json")));
});

test("an ignored path is treated as absent from that target", () => {
  const repoRoot = fixture();
  const cfg = JSON.parse(fs.readFileSync(path.join(repoRoot, "template.sources.json"), "utf8"));
  cfg.targets[0].ignore = ["drifted.ts"];
  fs.writeFileSync(path.join(repoRoot, "template.sources.json"), JSON.stringify(cfg));
  const { rows } = compareTemplate({ repoRoot });
  assert.equal(find(rows, "drifted.ts").targets.find((t) => t.name === "alpha").present, false);
});

test("a neverAdopt path is classified NEVER_ADOPT regardless of drift", () => {
  const repoRoot = fixture();
  const cfg = JSON.parse(fs.readFileSync(path.join(repoRoot, "template.sources.json"), "utf8"));
  cfg.neverAdopt = ["drifted.ts"];
  fs.writeFileSync(path.join(repoRoot, "template.sources.json"), JSON.stringify(cfg));
  const { rows } = compareTemplate({ repoRoot });
  assert.equal(find(rows, "drifted.ts").classification, "NEVER_ADOPT");
});

test("target content is generalized before comparison", () => {
  // A target file whose only difference is its own app name must read as ALIGNED.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cmp-gen-"));
  const repoRoot = path.join(root, "bootstrapper");
  write(path.join(repoRoot, "template/name.ts"), 'export const app = "{{name}}";');
  gitRepo(path.join(root, "alpha"), { "name.ts": 'export const app = "alpha";' }, "alpha");
  write(
    path.join(repoRoot, "template.sources.json"),
    JSON.stringify({ targets: [{ name: "alpha", path: "../alpha", appName: "alpha" }] }),
  );
  const { rows } = compareTemplate({ repoRoot });
  assert.equal(find(rows, "name.ts").classification, "ALIGNED");
});
```

- [ ] **Step 4: Run the tests**

Run: `node --test scripts/compare/__tests__/index.test.js`
Expected: 8 passing **once Tasks 2–6 have landed**. If a sibling module is still missing, the import error is expected — record it and move on; Task 10 runs the full suite.

---

## Task 8: `apply.js`

**Files:**
- Create: `scripts/compare/apply.js`
- Create: `scripts/compare/__tests__/apply.test.js`

**Interfaces:**
- Consumes: `generalize` (Task 2), `loadSources` (Task 4).
- Produces: `applyPaths({ repoRoot, target, paths, dryRun }) => { applied, skipped }`.

This is the half that executes a decision. It never decides anything itself: it copies exactly the paths it is given, re-generalizing as it goes. There is no path back to whole-tree copying.

- [ ] **Step 1: Write the module**

Create `scripts/compare/apply.js`:

```js
import fs from "node:fs";
import path from "node:path";
import { generalize } from "./lib/generalize.js";
import { loadSources, templateToAppPath } from "./lib/sources.js";

const BINARY = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg", ".woff", ".woff2", ".ttf", ".pdf"]);

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
    if (!fs.existsSync(source)) {
      skipped.push({ path: rel, reason: `not present in target ${target.name}` });
      continue;
    }
    const destination = path.join(templateDir, rel);
    if (dryRun) {
      applied.push(rel);
      continue;
    }
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (BINARY.has(path.extname(source).toLowerCase())) {
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
```

- [ ] **Step 2: Write the tests**

Create `scripts/compare/__tests__/apply.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyPaths } from "../apply.js";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "apply-"));
  const repoRoot = path.join(root, "bootstrapper");
  fs.mkdirSync(path.join(repoRoot, "template"), { recursive: true });
  const targetDir = path.join(root, "alpha");
  fs.mkdirSync(path.join(targetDir, "nested"), { recursive: true });
  fs.writeFileSync(path.join(targetDir, "a.ts"), 'const app = "alpha";');
  fs.writeFileSync(path.join(targetDir, "nested/b.ts"), 'const api = "alpha-api";');
  fs.writeFileSync(path.join(targetDir, ".gitignore"), "node_modules\n");
  return { repoRoot, target: { name: "alpha", dir: targetDir, appName: "alpha" } };
}

test("copies a file and re-generalizes it", () => {
  const { repoRoot, target } = fixture();
  const result = applyPaths({ repoRoot, target, paths: ["a.ts"] });
  assert.deepEqual(result.applied, ["a.ts"]);
  assert.equal(fs.readFileSync(path.join(repoRoot, "template/a.ts"), "utf8"), 'const app = "{{name}}";');
});

test("creates intermediate directories", () => {
  const { repoRoot, target } = fixture();
  applyPaths({ repoRoot, target, paths: ["nested/b.ts"] });
  assert.equal(
    fs.readFileSync(path.join(repoRoot, "template/nested/b.ts"), "utf8"),
    'const api = "{{name}}-api";',
  );
});

test("maps a template dotfile name back to the target's dotted name", () => {
  const { repoRoot, target } = fixture();
  const result = applyPaths({ repoRoot, target, paths: ["gitignore"] });
  assert.deepEqual(result.applied, ["gitignore"]);
  assert.ok(fs.existsSync(path.join(repoRoot, "template/gitignore")), "stored undotted in the template");
});

test("reports a path the target does not have instead of failing", () => {
  const { repoRoot, target } = fixture();
  const result = applyPaths({ repoRoot, target, paths: ["missing.ts"] });
  assert.deepEqual(result.applied, []);
  assert.equal(result.skipped[0].path, "missing.ts");
  assert.match(result.skipped[0].reason, /not present in target alpha/);
});

test("dryRun writes nothing but still reports what would be applied", () => {
  const { repoRoot, target } = fixture();
  const result = applyPaths({ repoRoot, target, paths: ["a.ts"], dryRun: true });
  assert.deepEqual(result.applied, ["a.ts"]);
  assert.equal(fs.existsSync(path.join(repoRoot, "template/a.ts")), false);
});

test("applies only the paths given — never the whole tree", () => {
  const { repoRoot, target } = fixture();
  applyPaths({ repoRoot, target, paths: ["a.ts"] });
  assert.equal(fs.existsSync(path.join(repoRoot, "template/nested/b.ts")), false);
});
```

- [ ] **Step 3: Run the tests**

Run: `node --test scripts/compare/__tests__/apply.test.js`
Expected: 6 passing.

---

## Task 9: The `template-sync` skill

**Files:**
- Create: `.claude/skills/template-sync/SKILL.md`
- Create: `.claude/skills/template-sync/references/precedence.md`
- Create: `.claude/skills/template-sync/references/never-adopt.md`
- Create: `.claude/skills/template-sync/references/integrity.md`
- Create: `.claude/skills/template-sync/references/verification.md`

**Interfaces:** none — markdown only. This task touches no JavaScript and conflicts with nothing.

Structure mirrors the `nja-architecture` skill (SKILL.md + routing + `references/`) so it feels familiar in this codebase.

- [ ] **Step 1: Write SKILL.md**

Frontmatter `name: template-sync`, and a `description` that says when to use it: merging drift from wyrdli/neural-erp into `create-carlonicora-app`'s template. Body covers the workflow in order:

`preflight → compare → triage → judge → apply → integrity → verify → report`

- **preflight** — targets exist and are on their default branch; `pnpm check:template` green before starting, so any later failure is attributable.
- **compare** — `pnpm compare:template`, producing `template-drift-report.{md,json}`.
- **triage** — `ALIGNED` needs nothing. `NEVER_ADOPT` is skipped without reading. `TEMPLATE_ONLY` is confirmed intentional against `templateOnly`. `TARGET_AHEAD` and `TARGET_ONLY` and `DIVERGED` go to judgement.
- **judge** — one row at a time, against `references/precedence.md`.
- **apply** — `pnpm template:apply --target <name> --paths <list>`.
- **integrity** — `pnpm check:template --strict` plus `pnpm test`.
- **verify** — `references/verification.md`.
- **report** — what was adopted, what was rejected, and why, per row.

- [ ] **Step 2: Write `references/precedence.md`**

The judgement rules, each with its rationale:

- **Recency is a hint, never a decision.** A file's last-commit date says when it was touched, not what advanced it.
- **Bulk commits are not evidence.** A commit touching >25 files is a rename or chore sweep. Measured case: on `.github/workflows/dev.yml`, both targets' most recent commits were bulk, and the "newer" one had *deleted* the `pnpm test` step.
- **The template keeps CI test steps and pre-push hooks even when a target deletes them.** A target removing its own test gate is a project decision; a scaffolder shipping without one is a defect.
- **Prefer i18n'd strings over hardcoded ones.** Measured case: the template's `VersionDisplay` uses `t("common.version_display")` while wyrdli hardcodes its product name.
- **Prefer library containers over hand-rolled equivalents.**
- **Prefer server-safe subpath imports in anything reachable from `instrumentation.ts`.** Measured case: importing `tokenUsageModules` from `/tokenusage` rather than `/core` crashed every generated app's dev server, and resolved, typechecked and passed its own check first.
- **Every adopted file is re-generalized and brand-swept** — `{{name}}` is kebab-case, `{{display}}` is human-readable, and mixing them inside one rendered file is visible to the end user.
- **When a target and the template disagree and both look defensible, keep the template.** The template serves projects that do not exist yet.

- [ ] **Step 3: Write `references/never-adopt.md`**

Each entry with the evidence for it:

- `apps/api/src/neo4j.migrations/**` — wyrdli and the template use **different bootstrap schemes**. Wyrdli's `20250901_002.ts` seeds *features*; the template's seeds *modules*. Not drift.
- `apps/api/src/config/config.ts`, `config.interface.ts` — each app extends these with app-specific fields (prompts, audio, responder tuning). The template's empty extension is correct.
- `packages/shared/src/index.ts` — an app's barrel exports its own domain.
- `packages/shared/src/const/module*.id.ts` — wyrdli's `ModuleId` holds campaign-entity UUIDs for assistant visibility; the template's holds RBAC module UUIDs seeded by migration 002. **Same exported symbol, different meaning.**
- `package.json`, `pnpm-lock.yaml` — dependency sets are project decisions.

- [ ] **Step 4: Write `references/integrity.md`**

Document the nine checks: what each catches, how to read its failure, and where its guarantee stops. Record the three known limitations explicitly:

- `admin-gate` matches token presence, not control-flow position — it catches removal of the role check, not an inverted one.
- `email-templates` checks existence only; an empty `.hbs` passes.
- `orphan-modules` cannot distinguish dead code from intentional unwired scaffolding, which is why `INTENTIONAL_STUBS` exists.

And the rule that governs all of them: **a check exists to describe a real defect. If a check fires on correct code, the check is wrong — fix the check, never the code.**

- [ ] **Step 5: Write `references/verification.md`**

The scaffold-and-boot gate, with the trap that motivated it:

1. `pnpm check:template --strict` and `pnpm test`.
2. `pnpm build`.
3. Scaffold with `--skip-git --skip-install` for the fast assertions: no junk copied, no unsubstituted `{{name}}`/`{{display}}`.
4. Scaffold a second app **with git**, so submodules are cloned and built. Steps 5–7 need them; `--skip-git` leaves `.gitkeep` placeholders and cannot install.
5. `pnpm install`, then `pnpm --filter <name>-web exec tsc --noEmit`.
6. Boot `pnpm dev:api` — the DI graph must build with no `UnknownDependenciesException`. "Cannot reach Neo4j" is a different and acceptable result.
7. Boot `pnpm dev:web` and request `/`. **A 200 is the gate, not "Ready"** — the server/client boundary crash that motivated this step happened during instrumentation, after the process reported ready.
8. Kill by captured PID or by port. **Never a name-pattern kill** — several projects run at once on this machine and a pattern kill destroys unrelated work.

- [ ] **Step 6: Verify the skill files are well-formed**

Confirm SKILL.md has valid frontmatter with `name` and `description`, that every `references/*.md` named in the routing table exists, and that no reference links to a file that was not created.

---

## Task 10 (Verification): wiring, retirement, full suite, single review

Runs after Tasks 1–9. This is the ONLY task that edits `package.json` and the only one that deletes files.

**Files:**
- Modify: `package.json`
- Delete: `scripts/sync-template.js`, `scripts/compare-template.ts`, `src/compare/` (7 files)
- Modify: `README.md` (any reference to the retired commands)

- [ ] **Step 1: Wire the scripts**

In `package.json`, remove `"sync-template"` and `"compare-template"`, and add:

```json
"test": "node --test scripts/",
"compare:template": "node scripts/compare/index.js",
"template:apply": "node scripts/compare/apply.js"
```

`check:template` stays as it is.

- [ ] **Step 2: Retire the old tooling**

```bash
rm -f scripts/sync-template.js scripts/compare-template.ts
rm -rf src/compare
```

**Do NOT delete `src/core-update/generalizer.ts`.** `src/core-update/patch-generator.ts`, `src/core-update/patch-applier.ts` and `src/commands/sync.ts` all import it; removing it breaks the build.

- [ ] **Step 3: Confirm nothing still references the retired modules**

```bash
grep -rn "sync-template\|compare-template\|src/compare" --include="*.ts" --include="*.js" --include="*.json" --include="*.md" . | grep -v node_modules | grep -v docs/superpowers
```

Expected: no hits outside plan/spec documents. Fix any that appear.

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: exit 0. This proves the `src/compare` deletion did not break the CLI's TypeScript graph.

- [ ] **Step 5: Run the whole test suite**

Run: `pnpm test`
Expected: every test from Tasks 1–8 passes. This is the first run where Task 7's integration tests can pass, since they need Tasks 2–6 present.

- [ ] **Step 6: Run the integrity harness**

Run: `pnpm check:template --strict`
Expected: all nine checks PASS, no SKIP.

If `bootstrapper-modules` now reports additional names because Task 1 widened its scan root, **report them — do not register them**. Whether each is a genuine gap is a judgement call for the user.

- [ ] **Step 7: Run the real comparison**

Run: `pnpm compare:template`
Expected: it completes against wyrdli and neural-erp and writes both report files. Read the counts. Sanity-check three rows by hand against the actual repos — a report that is confidently wrong is worse than none.

Report the classification counts and whether the `TARGET_AHEAD`/`DIVERGED` sets look plausible against what is known: the template is ahead on CI test steps, wyrdli is ahead on the admin routes and settings rail, and the migrations must land in `NEVER_ADOPT`.

- [ ] **Step 8: Architecture audit of the diff**

Compute scope from `git status --short`. Everything this plan creates lives in `scripts/`, `.claude/skills/`, or repo-root config — **none of it falls under the `nja-architecture` routing table**, which governs `apps/api/src/features`, `apps/web/src/features` and `packages/*/src`. State that explicitly rather than citing an unrelated reference doc. If any task has unexpectedly touched a file under `template/apps/`, that file IS governed — audit it against the routing table and report findings with severity, `file:line`, verbatim code, and the rule cited by skill-doc-path and section.

- [ ] **Step 9: Single whole-change review**

Per this plan's execution model there has been no per-task review. Dispatch ONE reviewer over the entire change on the most capable available model. Point it at: the Shared Contracts (did eight parallel implementers actually agree?), the test suite (do the tests assert behaviour, or merely that code exists?), and `classify.js`'s bulk-outranks-recency rule, which is the policy the whole tool turns on.

- [ ] **Step 10: Hand off — do NOT commit**

Report the test counts, the harness result, the comparison counts, the audit, and the review findings. The user commits after manual verification.

---

## Plan compliance check

### Routing-table applicability

Every file this plan creates or modifies lives in `scripts/`, `.claude/skills/`, or repo-root configuration. The `nja-architecture` routing table governs `apps/api/src/features/**`, `apps/web/src/features/**` and `packages/*/src/**`. **No file in this plan matches any row.** Per the skill's instruction for an unmatched file, `references/core-principles.md` was read; its Decision Matrix concerns JSON:API construction, `buildDefaultMatch()`, `callApi()`, raw Neo4j records and `overridesJsonApiCreation` — none of which this plan touches, because it introduces no entity, DTO, repository, service, controller, model, interface or component.

Per nja-writing-plan rule 3, no canonical example was invented for the contracts in "Shared Contracts": they are tooling-local signatures, declared explicitly out-of-scope for the routing table rather than given a fabricated citation.

### `references/anti-patterns.md` — walked top to bottom

| Anti-pattern (quoted) | Sections checked | Result |
|---|---|---|
| "`result.records[0]` — Returning raw Neo4j records" | all tasks | N/A — no repository code |
| "`WHERE company.id = $companyId` (manual) — Manual company filtering" | all tasks | N/A — no Cypher |
| "`SKIP ${offset} LIMIT ${limit}` — Manual pagination" | all tasks | N/A — no Cypher |
| "`{ data: { type: ..., attributes: ... } }` (manual) — Manual JSON:API construction" | all tasks | Clean — no payloads |
| "`fetch('/api/...')` — Using fetch() directly" | all tasks | Clean — no network calls |
| "`overridesJsonApiCreation: true` — Bypassing model validation" | all tasks | Clean — not used |
| "`asChild`, `<DialogContent>` as single component, `<Sub>` — Using Radix API" | all tasks | N/A — no JSX authored |
| "`<PopoverTrigger><Button>` or trigger wrapping Button" | all tasks | N/A — no JSX authored |
| "`someDate: { type: \"string\" }` for a calendar field" | all tasks | N/A — no descriptors |
| "`SET n.due_date = $due_date` in custom Cypher" | all tasks | N/A — no Cypher |
| "`SET n.processed_at = $processed_at` in custom Cypher" | all tasks | N/A — no Cypher |
| "`response.data.attributes.date = data.date` with `data.date: Date`" | all tasks | N/A — no models |
| "`get date(): string` on a frontend interface" | all tasks | N/A — no interfaces |
| "`@IsString()` for a date attribute on a DTO" | all tasks | N/A — no DTOs |

This plan authors no React, no NestJS, and no JSON:API. The only `Date` use is `new Date(seconds * 1000)` in `report.js` for display formatting — not an entity field, so `date-handling.md` does not apply.

### `references/frontend/04-components.md` and `05-typography.md`

Not applicable: no task authors JSX or styles text. Task 9 writes markdown.

### `references/core-principles.md` — Decision Matrix cross-check

| Question | Required answer | Plan |
|---|---|---|
| Should I manually construct JSON:API? | NO | Does not |
| Should I write raw Cypher without `buildDefaultMatch()`? | NO | No Cypher |
| Should I use `fetch()` in frontend services? | NO | No services |
| Should I return `result.records` from repository? | NO | No repositories |
| Should I use `overridesJsonApiCreation`? | NO | Not used |

### `references/date-handling.md`

Not applicable — no field of type date or datetime is introduced at any layer.

### Execution-model deviations, declared

This plan deliberately departs from subagent-driven-development's defaults at the user's explicit instruction: parallel implementers, no per-task review, tests in place of per-task review gates, one review at the end. nja-writing-plan rule 8 also calls for parallel dispatch, so the two agree here. Rule 9 (no commits) is honoured — there is no commit step anywhere in this plan.

### Result

No contradictions surfaced. Nothing unresolved.
