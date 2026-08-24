import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * These run the guard in a REAL child process, because the failure being
 * guarded against is entirely about how Node populates `process.argv[1]` versus
 * `import.meta.url`. Asserting on the function in-process would prove nothing.
 */
const PROBE = `import { isMain } from "GUARD_PATH";
console.log(isMain(import.meta.url) ? "MAIN" : "NOT_MAIN");
`;

const guardPath = new URL("../main-guard.js", import.meta.url).href;

function runProbe(dirName, { symlink = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "guard-"));
  const dir = path.join(root, dirName);
  fs.mkdirSync(dir, { recursive: true });
  const probe = path.join(dir, "probe.mjs");
  fs.writeFileSync(probe, PROBE.replace("GUARD_PATH", guardPath));

  let entry = probe;
  if (symlink) {
    entry = path.join(root, "linked.mjs");
    fs.symlinkSync(probe, entry);
  }
  return execFileSync(process.execPath, [entry], { encoding: "utf8" }).trim();
}

test("a plain path is detected as main", () => {
  assert.equal(runProbe("plain"), "MAIN");
});

test("a path containing a SPACE is still detected as main", () => {
  // The naive `import.meta.url === "file://" + process.argv[1]` is false here:
  // import.meta.url percent-encodes the space, argv[1] does not. The command
  // then exits 0 having done nothing, which reads as success.
  assert.equal(runProbe("space test"), "MAIN");
});

test("a path containing non-ASCII is still detected as main", () => {
  assert.equal(runProbe("café-dir"), "MAIN");
});

test("a path containing # is still detected as main", () => {
  assert.equal(runProbe("hash#dir"), "MAIN");
});

test("a SYMLINKED entry point is still detected as main", () => {
  // Node realpaths the module URL but leaves argv[1] as typed.
  assert.equal(runProbe("real", { symlink: true }), "MAIN");
});

test("a module that is not the entry point is NOT main", async () => {
  const { isMain } = await import("../main-guard.js");
  assert.equal(isMain("file:///definitely/not/the/entry/point.js"), false);
});
