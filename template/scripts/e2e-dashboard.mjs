#!/usr/bin/env node
/**
 * E2E dashboard — a dependency-free Node app that runs `scripts/e2e.sh` and
 * renders every test as a live semaphore.
 *
 *   pnpm e2e:dash            # then open http://127.0.0.1:4084
 *
 * How it fits together
 * --------------------
 *   e2e-dashboard.mjs  --spawn-->  scripts/e2e.sh  -->  playwright
 *        |   ^ parses "==> [e2e] ..." stdout into boot phases  |
 *        |   ^ tails NDJSON <-- tests/reporters/dashboard-reporter.ts
 *        v
 *      SSE  -->  e2e-dashboard.html
 *
 * Pressing Run does two passes:
 *   1. `playwright test --list` (E2E_DASH_LIST=1) — needs NO stack and takes
 *      ~10s, so the page paints every row as pending semaphores before the
 *      3-5 minute stack boot starts.
 *   2. `scripts/e2e.sh <args>` — the real run. Its own `==>` progress lines
 *      drive the boot strip; the reporter drives the test rows.
 *
 * Stop signals the process group we created for this run — the script AND the
 * playwright process it is waiting on. Signalling the script alone is not
 * enough: bash defers a trap until its current foreground command returns, so
 * during the Playwright phase nothing would happen at all. e2e.sh's
 * `trap cleanup EXIT INT TERM` then frees only ports 4080-4082.
 *
 * No pattern kill is used anywhere in this file. Every process signalled is
 * either a PID we spawned, a process group we created, or (only after a
 * SIGKILL skipped e2e.sh's own cleanup) whatever `lsof` reports as LISTENING
 * on one of those four ports.
 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const PORT = Number(process.env.E2E_DASH_PORT ?? 4084);
const HOST = "127.0.0.1";
const COVERAGE_DOC = path.join(ROOT, "e2e-coverage.md");
const REPORT_DIR = path.join(ROOT, "apps", "web", "playwright-report");
const PUBLIC_DIR = path.join(ROOT, "apps", "web", "public");
// Served straight from the web app's own public/ so the dashboard follows the
// real brand instead of carrying a copy that silently goes stale. An explicit
// allowlist, so this is not a general static file server over the repo.
const ASSETS = new Set(["logo.webp", "favicon.ico"]);
const PAGE = path.join(HERE, "e2e-dashboard.html");
const RUNS_DIR = path.join(os.tmpdir(), "{{name}}-e2e-dashboard");
const MAX_LOG_LINES = 1200;

// ---------------------------------------------------------------------------
// Pure parsers (exported for scripts/e2e-dashboard.test.mjs)
// ---------------------------------------------------------------------------

/**
 * The boot phases of scripts/e2e.sh, in the order the script prints them.
 * Each entry matches the text that follows the script's own "==> [e2e] "
 * marker. Order matters: `starting WORKER` is tested before `starting WEB`
 * would ever be reached, and neither pattern can match the other's line.
 */
export const STACK_PHASES = [
  { key: "ports", label: "Free test ports", match: /^freeing test ports/ },
  { key: "packages", label: "Build workspace packages", match: /^building workspace packages/ },
  { key: "databases", label: "Reset test database", match: /^recreating test database/ },
  { key: "worker", label: "Start worker", match: /^starting WORKER/ },
  { key: "migrations", label: "Apply migrations", match: /^waiting for migrations/ },
  { key: "api", label: "Start API", match: /^starting API/ },
  { key: "webBuild", label: "Build web app", match: /^building WEB/ },
  { key: "webStart", label: "Start web app", match: /^starting WEB/ },
  { key: "health", label: "Wait for services", match: /^waiting for http/ },
  { key: "playwright", label: "Run tests", match: /^stack is up/ },
  { key: "teardown", label: "Shut down stack", match: /^tearing down stack/ },
];

/** The five ways scripts/e2e.sh reports a hard boot failure and exits. */
const STACK_FAILURES = [
  { key: "packages", match: /^\[e2e\] workspace package build failed/ },
  { key: "databases", match: /^\[e2e\] recreate failed/ },
  { key: "migrations", match: /^\[e2e\] FAILED: migrations not applied/ },
  { key: "webBuild", match: /^\[e2e\] web build failed/ },
  { key: "health", match: /^\[e2e\] .* never came up/ },
];

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
const stripAnsi = (value) => value.replace(ANSI, "");

/**
 * Classify one line of scripts/e2e.sh output.
 * Returns null for ordinary sub-process output (which becomes log lines only).
 */
export function parseStackLine(raw) {
  const line = stripAnsi(String(raw)).trim();

  const marker = line.match(/^==> \[e2e\] (.*)$/);
  if (marker) {
    const rest = marker[1];

    const exited = rest.match(/^Playwright exited with code (\d+)/);
    if (exited) {
      return { type: "phase-end", key: "playwright", ok: exited[1] === "0", detail: rest };
    }
    // "migrations applied — starting API + WEB" closes the migration
    // wait; the API/WEB phases announce themselves on their own lines.
    if (/^migrations applied/.test(rest)) {
      return { type: "phase-end", key: "migrations", ok: true, detail: rest };
    }

    const phase = STACK_PHASES.find((candidate) => candidate.match.test(rest));
    if (phase) return { type: "phase-start", key: phase.key, label: phase.label, detail: rest };
    return { type: "note", detail: rest };
  }

  const failure = STACK_FAILURES.find((candidate) => candidate.match.test(line));
  if (failure) return { type: "phase-end", key: failure.key, ok: false, detail: line };

  return null;
}

/**
 * Pull every coverage id out of a Playwright test title.
 * Handles both title conventions in this suite:
 *   "AUTH-32: selecting a company ..."              -> ["AUTH-32"]
 *   "... row navigates to the detail (ADM-04/05/08)" -> ["ADM-04","ADM-05","ADM-08"]
 * False positives are impossible downstream because every id is then looked up
 * in the coverage map and dropped if absent.
 */
export function extractIds(title) {
  const ids = [];
  const pattern = /\b([A-Z]{2,5})-(\d+[a-z]?(?:\s*\/\s*\d+[a-z]?)*)/g;
  let match;
  while ((match = pattern.exec(String(title))) !== null) {
    for (const part of match[2].split("/")) ids.push(`${match[1]}-${part.trim()}`);
  }
  return ids;
}

/**
 * Parse e2e-coverage.md into id -> { summary, status, detail[] }.
 *
 * Entries look like:
 *   #### ADM-01 · Hub renders all five card groups — ✅ `spec` › "title"
 *   - **Given** platformAdmin is logged in
 *   - **When** ...
 *
 * The summary is cut at the first status glyph rather than at the first " — "
 * so a summary that itself contains an em dash is not truncated. The glyph is
 * matched with the /u flag because 🟡 and 🚧 are outside the BMP.
 */
export function parseCoverage(markdown) {
  const entries = new Map();
  // A heading also CITES the spec that covers it, as `tests/<file>` › "exact title".
  // That citation is the only handle on the 300-odd tests whose titles carry no id
  // at all (the generated route smokes), so it is indexed alongside the ids.
  const byFileTitle = new Map();
  const byTitle = new Map();
  let current = null;

  for (const line of String(markdown).split("\n")) {
    const heading = line.match(/^####\s+([A-Z]{2,5}-\d+[a-z]?)\s+·\s+(.*)$/);
    if (heading) {
      const rest = heading[2];
      const glyph = rest.match(/[✅🟡❌⛔🚧]/u);
      const summary = (glyph ? rest.slice(0, glyph.index) : rest).replace(/\s*—\s*$/, "").trim();
      current = { id: heading[1], summary, status: glyph ? glyph[0] : "", detail: [] };
      entries.set(current.id, current);
      for (const cite of rest.matchAll(/`tests\/([^`]+)`\s*›\s*"((?:[^"\\]|\\.)*)"/g)) {
        const title = cite[2].replace(/\\"/g, '"');
        const key = `${cite[1]}::${title}`;
        if (!byFileTitle.has(key)) byFileTitle.set(key, []);
        byFileTitle.get(key).push(current.id);
        if (!byTitle.has(title)) byTitle.set(title, []);
        byTitle.get(title).push(current.id);
      }
      continue;
    }
    if (/^#{1,6}\s/.test(line) || /^---\s*$/.test(line)) {
      current = null;
      continue;
    }
    if (current && /^\s*-\s+/.test(line)) current.detail.push(line.replace(/^\s*-\s+/, "").trim());
  }

  entries.byFileTitle = byFileTitle;
  entries.byTitle = byTitle;
  return entries;
}

/**
 * Playwright project ids are runner plumbing ("chromium-unauth"), not something
 * to show a human. Map them to what the project actually IS, per the `projects`
 * block in playwright.config.ts. An unknown project falls back to its raw id
 * rather than guessing — add a row here when a project is added there.
 */
const PROJECT_LABELS = {
  setup: "Setup — seed & login",
  "chromium-unauth": "Logged out",
  "chromium-smoke": "Page smoke — logged in",
  "chromium-pwa": "Service worker",
  "chromium-auth": "Logged in",
};

export function projectLabel(project) {
  return PROJECT_LABELS[project] ?? project;
}

/** Words that must not be sentence-cased when a filename is humanised. */
const ACRONYMS = new Set(["pwa", "rbac", "kpi", "ai", "api", "ui", "otp", "sso", "pdf"]);

/** Files whose name says nothing useful on its own. */
const FILE_TITLES = {
  "support/smoke.ts": "Route smoke checks",
  "setup/seed.setup.ts": "Seed database & log in",
};

/**
 * Turn a spec path into a readable group title:
 *   "unauthenticated/auth-flows.spec.ts"  -> "Auth flows"
 *   "smoke/admin.smoke.spec.ts"           -> "Admin"
 *   "smoke/features-a.smoke.spec.ts"      -> "Features A"
 * The full path is still shown next to it, so nothing is hidden by this.
 */
export function fileTitle(file) {
  if (FILE_TITLES[file]) return FILE_TITLES[file];

  const base = (file.split("/").pop() ?? file).replace(/\.(spec|setup)\.ts$/, "").replace(/\.smoke$/, "").replace(/\.ts$/, "");

  const words = base.split(/[-_.]/).filter(Boolean).map((word) => {
    if (ACRONYMS.has(word.toLowerCase())) return word.toUpperCase();
    if (word.length === 1) return word.toUpperCase();
    return word;
  });

  if (!words.length) return file;
  const first = words[0];
  // Sentence case, but never re-case a word already resolved to an acronym.
  words[0] = first === first.toUpperCase() && first.length > 1 ? first : first.charAt(0).toUpperCase() + first.slice(1);
  return words.join(" ");
}

/** Split a scope string the way a shell would, honouring single/double quotes. */
export function splitArgs(input) {
  const out = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match;
  while ((match = pattern.exec(String(input ?? "").trim())) !== null) {
    out.push(match[1] ?? match[2] ?? match[3]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Server state
// ---------------------------------------------------------------------------

const coverage = (() => {
  try {
    return parseCoverage(fs.readFileSync(COVERAGE_DOC, "utf8"));
  } catch {
    console.warn(`[dash] ${path.relative(ROOT, COVERAGE_DOC)} not readable — descriptions disabled`);
    return parseCoverage("");
  }
})();

const state = {
  run: { id: null, args: "", running: false, startedAt: null, endedAt: null, exitCode: null, message: "" },
  phases: [],
  tests: new Map(),
  logs: [],
};

let child = null;
let stopping = false;
let killTimer = null;
let tail = null;
let tailTimer = null;
const clients = new Set();
let pendingLogs = [];
let logFlushTimer = null;

const broadcast = (event) => {
  const frame = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) client.write(frame);
};

const snapshot = () => ({
  t: "snapshot",
  // Mirrors playwright.config.ts's `projects`; `setup` is excluded because it
  // always runs as a dependency and is never scoped to on its own.
  projects: Object.entries(PROJECT_LABELS)
    .filter(([id]) => id !== "setup")
    .map(([id, label]) => ({ id, label })),
  run: state.run,
  phases: state.phases,
  tests: [...state.tests.values()],
  logs: state.logs,
});

function pushLog(line) {
  state.logs.push(line);
  if (state.logs.length > MAX_LOG_LINES) state.logs.splice(0, state.logs.length - MAX_LOG_LINES);
  // The web build alone emits thousands of lines; batch them so SSE does not
  // become the bottleneck.
  pendingLogs.push(line);
  if (logFlushTimer) return;
  logFlushTimer = setTimeout(() => {
    logFlushTimer = null;
    const lines = pendingLogs;
    pendingLogs = [];
    if (lines.length) broadcast({ t: "log", lines });
  }, 200);
}

function setPhase(key, label, status, detail) {
  let phase = state.phases.find((candidate) => candidate.key === key);
  if (!phase) {
    phase = { key, label, status: "pending", detail: "", startedAt: null, endedAt: null };
    state.phases.push(phase);
  }
  if (label) phase.label = label;
  if (detail !== undefined) phase.detail = detail;
  if (status === "running" && phase.status !== "running") {
    phase.status = "running";
    phase.startedAt = Date.now();
  } else if (status && status !== "running") {
    phase.status = status;
    phase.endedAt = Date.now();
  }
  broadcast({ t: "phase", phase });
  return phase;
}

/** e2e.sh is strictly sequential: announcing a phase means the previous ones passed. */
function closeRunningPhases(except) {
  for (const phase of state.phases) {
    if (phase.status === "running" && phase.key !== except) {
      phase.status = "ok";
      phase.endedAt = Date.now();
      broadcast({ t: "phase", phase });
    }
  }
}

function failRunningPhases() {
  for (const phase of state.phases) {
    if (phase.status === "running") {
      phase.status = "failed";
      phase.endedAt = Date.now();
      broadcast({ t: "phase", phase });
    }
  }
}

function setRun(patch) {
  Object.assign(state.run, patch);
  broadcast({ t: "run", run: state.run });
}

// ---------------------------------------------------------------------------
// Reporter event handling
// ---------------------------------------------------------------------------

/**
 * The suite puts the coverage id at the FRONT of every test title
 * (`PRC-11: walks the happy status path`). The dashboard shows that verbatim —
 * it is the first thing to read on a row, so it is never moved, shortened or
 * relocated to a separate column.
 */

const sameText = (a, b) =>
  String(a).toLowerCase().replace(/[^a-z0-9]/g, "") === String(b).toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Resolve a test to its coverage entries, most specific handle first:
 * the id in its own title, then the doc's `file › "title"` citation, then that
 * citation by title alone (the generated route smokes report their location as
 * the helper that calls `test()`, not the spec that declares the route table).
 */
function coverageFor(entry) {
  const fromTitle = extractIds(entry.title).filter((id) => coverage.has(id));
  if (fromTitle.length) return fromTitle;
  return coverage.byFileTitle.get(`${entry.file}::${entry.title}`) ?? coverage.byTitle.get(entry.title) ?? [];
}

function describeTest(entry) {
  const ids = coverageFor(entry);
  const docs = ids.map((id) => coverage.get(id)).filter(Boolean);
  const title = entry.title;
  const summary = docs.map((doc) => doc.summary).join(" · ");
  return {
    ...entry,
    projectLabel: projectLabel(entry.project),
    fileTitle: fileTitle(entry.file),
    title,
    rawTitle: entry.title,
    ids,
    // A description that only restates the title is noise on every row.
    summary: sameText(summary, title) ? "" : summary,
    coverageStatus: docs.map((doc) => doc.status).join(""),
    detail: docs.flatMap((doc) => (docs.length > 1 ? [`**${doc.id}**`, ...doc.detail] : doc.detail)),
    status: "pending",
    duration: 0,
    retry: 0,
    errors: [],
  };
}

function applyCatalogue(tests) {
  for (const entry of tests) {
    const existing = state.tests.get(entry.id);
    // A second catalogue (the real run, after the --list pass) must not wipe
    // results that already arrived.
    if (existing) {
      Object.assign(existing, {
        ...entry,
        title: existing.title,
        rawTitle: existing.rawTitle,
        projectLabel: existing.projectLabel,
        fileTitle: existing.fileTitle,
        ids: existing.ids,
        summary: existing.summary,
        detail: existing.detail,
        coverageStatus: existing.coverageStatus,
        status: existing.status,
        duration: existing.duration,
        retry: existing.retry,
        errors: existing.errors,
      });
      continue;
    }
    state.tests.set(entry.id, describeTest(entry));
  }
  broadcast({ t: "catalogue", tests: [...state.tests.values()] });
}

function handleReporterEvent(event) {
  if (event.t === "catalogue") {
    applyCatalogue(event.tests ?? []);
    return;
  }
  if (event.t === "begin") {
    const test = state.tests.get(event.id);
    if (!test) return;
    test.status = "running";
    test.retry = event.retry ?? 0;
    test.startedAt = event.at;
    broadcast({ t: "test", test });
    return;
  }
  if (event.t === "end") {
    const test = state.tests.get(event.id);
    if (!test) return;
    // `outcome` already folds retries into flaky/expected/unexpected; `status`
    // is the raw per-attempt result. Prefer outcome, fall back to status.
    const outcome = event.outcome;
    test.status =
      outcome === "flaky"
        ? "flaky"
        : outcome === "skipped"
          ? "skipped"
          : outcome === "unexpected"
            ? "failed"
            : event.status === "passed"
              ? "passed"
              : (event.status ?? "failed");
    test.duration = event.duration ?? 0;
    test.retry = event.retry ?? 0;
    test.errors = event.errors ?? [];
    broadcast({ t: "test", test });
    return;
  }
  if (event.t === "runEnd") {
    // Ignored deliberately: the authoritative end is e2e.sh exiting, which also
    // covers the case where the stack never came up and Playwright never ran.
  }
}

function startTail(file) {
  stopTail();
  tail = { file, offset: 0, buffer: "" };
  tailTimer = setInterval(pumpTail, 150);
}

function stopTail() {
  if (tailTimer) clearInterval(tailTimer);
  tailTimer = null;
  pumpTail();
  tail = null;
}

function pumpTail() {
  if (!tail) return;
  let stat;
  try {
    stat = fs.statSync(tail.file);
  } catch {
    return;
  }
  if (stat.size <= tail.offset) return;

  const length = stat.size - tail.offset;
  const buffer = Buffer.alloc(length);
  const fd = fs.openSync(tail.file, "r");
  try {
    fs.readSync(fd, buffer, 0, length, tail.offset);
  } finally {
    fs.closeSync(fd);
  }
  tail.offset = stat.size;
  tail.buffer += buffer.toString("utf8");

  const lines = tail.buffer.split("\n");
  tail.buffer = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue; // a torn final line is re-read on the next pump
    }
    try {
      handleReporterEvent(event);
    } catch (error) {
      pushLog(`[dash] reporter event dropped: ${error.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

function lineReader(stream, onLine) {
  let carry = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    carry += chunk;
    const lines = carry.split("\n");
    carry = lines.pop() ?? "";
    for (const line of lines) onLine(line);
  });
  stream.on("end", () => {
    if (carry.trim()) onLine(carry);
  });
}

function startRun(scope) {
  if (state.run.running) return { ok: false, error: "a run is already in progress" };

  const args = splitArgs(scope);
  const id = String(Date.now());
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  const eventsFile = path.join(RUNS_DIR, `${id}.ndjson`);
  fs.writeFileSync(eventsFile, "");

  state.phases = [];
  state.tests = new Map();
  state.logs = [];
  stopping = false;
  setRun({ id, args: args.join(" "), running: true, startedAt: Date.now(), endedAt: null, exitCode: null, message: "" });
  broadcast(snapshot());

  startTail(eventsFile);
  setPhase("enumerate", "Find tests", "running", "playwright test --list");

  const baseEnv = { ...process.env, E2E_DASH_EVENTS: eventsFile };

  const list = spawn(
    "pnpm",
    ["--filter", "{{name}}-web", "exec", "playwright", "test", "--list", ...args],
    { cwd: ROOT, env: { ...baseEnv, E2E_DASH_LIST: "1" }, stdio: ["ignore", "pipe", "pipe"] },
  );
  child = list;
  lineReader(list.stdout, (line) => pushLog(`[list] ${line}`));
  lineReader(list.stderr, (line) => pushLog(`[list] ${line}`));

  list.on("error", (error) => {
    child = null;
    setPhase("enumerate", null, "failed", error.message);
    finishRun(null, `could not start playwright: ${error.message}`);
  });

  list.on("exit", (code) => {
    child = null;
    pumpTail(); // drain the catalogue the reporter just wrote before reading its size
    if (!state.run.running) return; // stopped while listing
    if (code !== 0) {
      setPhase("enumerate", null, "failed", `playwright --list exited ${code}`);
      finishRun(code, "test enumeration failed — check the scope arguments in the log below");
      return;
    }
    setPhase("enumerate", null, "ok", `${state.tests.size} tests`);
    spawnStack(args, baseEnv);
  });

  return { ok: true, id };
}

function spawnStack(args, baseEnv) {
  // `detached: true` puts e2e.sh in its OWN process group, which is what makes
  // Stop work at all. Signalling the script's PID alone is useless during the
  // Playwright phase: bash defers a trap until the current foreground command
  // returns, and that command IS `playwright test` — which never saw the
  // signal, so the suite ran on for its full duration. Signalling the GROUP
  // (`process.kill(-pid)`) reaches playwright too; it dies, bash's foreground
  // command returns, and its `trap cleanup` then frees ports 4080-4082.
  //
  // This is a group we created and populated ourselves — not a name-pattern
  // kill. Nothing outside this run can be in it.
  const stack = spawn("bash", [path.join(ROOT, "scripts", "e2e.sh"), ...args], {
    cwd: ROOT,
    env: baseEnv,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  child = stack;

  const onLine = (line) => {
    pushLog(line);
    const parsed = parseStackLine(line);
    if (!parsed) return;
    if (parsed.type === "phase-start") {
      closeRunningPhases(parsed.key);
      setPhase(parsed.key, parsed.label, "running", parsed.detail);
    } else if (parsed.type === "phase-end") {
      setPhase(parsed.key, null, parsed.ok ? "ok" : "failed", parsed.detail);
      if (!parsed.ok) failRunningPhases();
    }
  };

  lineReader(stack.stdout, onLine);
  lineReader(stack.stderr, onLine);

  stack.on("error", (error) => {
    child = null;
    finishRun(null, `could not start scripts/e2e.sh: ${error.message}`);
  });

  // `exit`, NOT `close`: e2e.sh's grandchildren (api / worker / web)
  // inherit its stdout pipe, so the pipe does not reach EOF while any of them
  // survives — and `close` waits for that EOF. After a hard kill the dashboard
  // would sit at "running" forever. `exit` fires the moment the script dies.
  stack.on("exit", (code, signal) => {
    child = null;
    if (killTimer) clearTimeout(killTimer);
    killTimer = null;
    const message = stopping
      ? "stopped — stack torn down"
      : code === 0
        ? ""
        : `e2e.sh exited with ${signal ? `signal ${signal}` : `code ${code}`}`;
    finishRun(code, message);
  });
}

function finishRun(exitCode, message) {
  stopTail();
  closeRunningPhases(null);
  if (exitCode !== 0) failRunningPhases();
  // Anything still pending or spinning never actually ran (a boot failure, or
  // Stop) — say so rather than leaving grey rows that look merely queued.
  for (const test of state.tests.values()) {
    if (test.status === "pending" || test.status === "running") {
      test.status = "notrun";
      broadcast({ t: "test", test });
    }
  }
  setRun({ running: false, endedAt: Date.now(), exitCode, message: message ?? "" });
}

/**
 * Last-resort port sweep, used only after a SIGKILL skipped e2e.sh's own
 * cleanup. Kills what is LISTENING on the three e2e ports and nothing else —
 * never by process name, so it cannot touch another project on this machine.
 */
function freeE2ePorts() {
  // Same env vars + defaults as scripts/e2e.sh. This process's own env is what
  // e2e.sh inherits when it spawns, so it matches the runner's actual ports —
  // but an override that lives ONLY in .env.e2e (not exported here) is still
  // out of reach; that file is loaded by e2e.sh itself, not by this script.
  const ports = [
    Number(process.env.E2E_API_PORT ?? 4080),
    Number(process.env.E2E_WEB_PORT ?? 4081),
    Number(process.env.E2E_WORKER_HEALTH_PORT ?? 4082),
  ];
  for (const port of ports) {
    let pids = [];
    try {
      pids = execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" })
        .split("\n")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0);
    } catch {
      continue; // lsof exits non-zero when nothing is listening
    }
    for (const pid of pids) {
      try {
        process.kill(pid, "SIGKILL");
        pushLog(`[dash] freed port ${port} (pid ${pid})`);
      } catch {
        /* already gone */
      }
    }
  }
}

function stopRun() {
  if (!state.run.running || !child) return { ok: false, error: "nothing is running" };
  stopping = true;
  const target = child;

  // Signal the whole process group, not just the script. See spawnStack() for
  // why the script's PID alone cannot stop a run that has reached Playwright.
  // The list pass is not detached (it has no grandchildren to strand), so fall
  // back to signalling it directly.
  const signalGroup = (signal) => {
    try {
      if (target.spawnargs?.[0] === "bash") process.kill(-target.pid, signal);
      else target.kill(signal);
    } catch (error) {
      if (error.code !== "ESRCH") throw error; // ESRCH = already gone
    }
  };

  pushLog("[dash] stopping — SIGTERM to the run's process group; e2e.sh's trap then frees ports 4080-4082");
  signalGroup("SIGTERM");

  killTimer = setTimeout(() => {
    if (child !== target) return;
    pushLog("[dash] still alive after 15s — SIGKILL to the same group");
    signalGroup("SIGKILL");
    // A SIGKILLed script never runs its own cleanup, so free its ports here.
    // Only these four, and only by what is listening on them.
    setTimeout(() => freeE2ePorts(), 2000);
  }, 15000);

  setRun({ message: "stopping — tearing down the stack…" });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".zip": "application/zip",
  ".webm": "video/webm",
};

const sendJson = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(payload) });
  res.end(payload);
};

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) req.destroy();
    });
    req.on("end", () => resolve(data));
  });
}

function serveReport(res, rest) {
  const relative = rest === "" || rest === "/" ? "/index.html" : rest;
  const target = path.join(REPORT_DIR, path.normalize(relative).replace(/^(\.\.[/\\])+/, ""));
  if (!target.startsWith(REPORT_DIR)) {
    res.writeHead(403).end("forbidden");
    return;
  }
  fs.readFile(target, (error, data) => {
    if (error) {
      res.writeHead(404, { "content-type": "text/plain" }).end("no report yet — run the suite first");
      return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(target)] ?? "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const route = url.pathname;

  if (route === "/" || route === "/index.html") {
    // Read per request so editing the page needs no server restart.
    fs.readFile(PAGE, (error, data) => {
      if (error) {
        res.writeHead(500, { "content-type": "text/plain" }).end(`cannot read ${PAGE}`);
        return;
      }
      res.writeHead(200, { "content-type": MIME[".html"], "cache-control": "no-store" });
      res.end(data);
    });
    return;
  }

  if (route === "/api/stream") {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      connection: "keep-alive",
    });
    res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
    clients.add(res);
    const heartbeat = setInterval(() => res.write(": ping\n\n"), 20000);
    req.on("close", () => {
      clearInterval(heartbeat);
      clients.delete(res);
    });
    return;
  }

  if (route === "/api/state") {
    sendJson(res, 200, snapshot());
    return;
  }

  if (route === "/api/run" && req.method === "POST") {
    const body = await readBody(req);
    let scope = "";
    try {
      scope = JSON.parse(body || "{}").scope ?? "";
    } catch {
      scope = "";
    }
    const result = startRun(scope);
    sendJson(res, result.ok ? 200 : 409, result);
    return;
  }

  if (route === "/api/stop" && req.method === "POST") {
    const result = stopRun();
    sendJson(res, result.ok ? 200 : 409, result);
    return;
  }

  if (route.startsWith("/assets/")) {
    const name = route.slice("/assets/".length);
    if (!ASSETS.has(name)) {
      res.writeHead(404, { "content-type": "text/plain" }).end("not found");
      return;
    }
    fs.readFile(path.join(PUBLIC_DIR, name), (error, data) => {
      if (error) {
        res.writeHead(404, { "content-type": "text/plain" }).end("not found");
        return;
      }
      res.writeHead(200, {
        "content-type": MIME[path.extname(name)] ?? "application/octet-stream",
        "cache-control": "max-age=300",
      });
      res.end(data);
    });
    return;
  }

  if (route === "/report" || route.startsWith("/report/")) {
    serveReport(res, route.slice("/report".length));
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" }).end("not found");
});

function shutdown() {
  // The stack runs in its own process group (see spawnStack), so a Ctrl+C here
  // no longer reaches it by inheritance — signal it explicitly or the whole
  // stack is orphaned when the dashboard exits.
  if (child) {
    try {
      if (child.spawnargs?.[0] === "bash") process.kill(-child.pid, "SIGTERM");
      else child.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  }
  process.exit(0);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`[dash] port ${PORT} is already in use. Close the other dashboard, or run with E2E_DASH_PORT=<port>.`);
      process.exit(1);
    }
    throw error;
  });
  server.listen(PORT, HOST, () => {
    console.log(`[dash] e2e dashboard on http://${HOST}:${PORT}`);
    console.log(`[dash] ${coverage.size} coverage descriptions loaded from ${path.relative(ROOT, COVERAGE_DOC)}`);
  });
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
