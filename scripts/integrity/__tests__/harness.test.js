import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import check, { stripComments } from "../checks/bootstrapper-modules.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");

const write = (file, body) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
};

/**
 * A fake library checkout + template, so the check can be exercised against
 * known inputs. Earlier versions of these tests regex-matched the check's own
 * SOURCE, which passes just as happily when the behaviour is broken.
 */
function fixture({ libSrc = {}, bootstrapper = null, makeLibSrcDir = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "integrity-"));
  const libDir = path.join(root, "fakelib");
  write(path.join(libDir, "package.json"), '{"name":"@carlonicora/nextjs-jsonapi"}');
  if (makeLibSrcDir) fs.mkdirSync(path.join(libDir, "src"), { recursive: true });
  for (const [rel, body] of Object.entries(libSrc)) write(path.join(libDir, "src", rel), body);

  const templateDir = path.join(root, "template");
  if (bootstrapper !== null) write(path.join(templateDir, "apps/web/src/config/Bootstrapper.ts"), bootstrapper);
  else fs.mkdirSync(templateDir, { recursive: true });

  return {
    root,
    ctx: {
      repoRoot: root,
      templateDir,
      config: { libraries: { "@carlonicora/nextjs-jsonapi": "./fakelib" } },
    },
  };
}

test("the runner awaits check.run, so an async check's failures are reported", () => {
  // Run the REAL runner over a fixture check whose run() is async. Without the
  // await, `failures` is a Promise: `failures.length` is undefined, the FAIL
  // branch is taken, and `for...of` throws on a non-iterable.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "runner-"));
  const integrityDir = path.join(root, "scripts", "integrity");
  fs.mkdirSync(integrityDir, { recursive: true });
  fs.copyFileSync(path.join(repoRoot, "scripts/integrity/index.js"), path.join(integrityDir, "index.js"));
  fs.cpSync(path.join(repoRoot, "scripts/integrity/lib"), path.join(integrityDir, "lib"), { recursive: true });
  write(
    path.join(integrityDir, "checks", "async-fixture.js"),
    `export default {
       id: "async-fixture",
       title: "an asynchronous check",
       async run() { return ["the async failure message"]; },
     };`,
  );

  let stdout = "";
  let status = 0;
  try {
    stdout = execFileSync(process.execPath, [path.join(integrityDir, "index.js")], { encoding: "utf8" });
  } catch (error) {
    stdout = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    status = error.status;
  }

  assert.match(stdout, /FAIL {2}async-fixture/, "an async check's FAIL line must be printed");
  assert.match(stdout, /the async failure message/, "its failure messages must be iterated, not a Promise");
  assert.equal(status, 1, "a failing check must exit non-zero");
});

test("stripComments keeps a Modules reference that follows a URL on the same line", () => {
  const source = 'const docs = "https://example.com/x"; const m = Modules.Notification;';
  assert.match(
    stripComments(source),
    /Modules\.Notification/,
    "the '://' in a string must not be treated as a line comment",
  );
});

test("stripComments still removes real line and block comments", () => {
  assert.doesNotMatch(stripComments("code // Modules.Ghost"), /Modules\.Ghost/);
  assert.doesNotMatch(stripComments("code /* Modules.Ghost */ more"), /Modules\.Ghost/);
});

test("the check finds a Modules.X dereferenced OUTSIDE src/features", () => {
  // The scan root was src/features, which missed real runtime dereferences such
  // as src/hooks/useSocket.ts. This asserts the widened root actually reports.
  const { ctx } = fixture({
    libSrc: { "hooks/useSocket.ts": "rehydrate(Modules.Notification, payload);" },
    bootstrapper: "export const allModules = {\n  Company: CompanyModule(moduleFactory),\n};",
  });
  const failures = check.run(ctx);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /Modules\.Notification is used by the library but not registered/);
});

test("a registered module outside src/features produces no failure", () => {
  const { ctx } = fixture({
    libSrc: { "hooks/useSocket.ts": "rehydrate(Modules.Notification, payload);" },
    bootstrapper: "export const allModules = {\n  Notification: NotificationModule(moduleFactory),\n};",
  });
  assert.deepEqual(check.run(ctx), []);
});

test("a missing library src root FAILs cleanly instead of throwing ENOENT", () => {
  const { ctx } = fixture({ makeLibSrcDir: false, bootstrapper: "export const allModules = {};" });
  let failures;
  assert.doesNotThrow(() => {
    failures = check.run(ctx);
  }, "a missing root must not abort the whole harness");
  assert.equal(failures.length, 1);
  assert.match(failures[0], /expected directory is missing/);
  assert.match(failures[0], /inspected nothing/);
});

test("a missing Bootstrapper.ts FAILs cleanly instead of throwing", () => {
  const { ctx } = fixture({ libSrc: { "hooks/useSocket.ts": "Modules.Notification;" }, bootstrapper: null });
  let failures;
  assert.doesNotThrow(() => {
    failures = check.run(ctx);
  });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /Bootstrapper\.ts/);
  assert.match(failures[0], /inspected nothing/);
});
