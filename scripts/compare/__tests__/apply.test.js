import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyPaths, parseArgs } from "../apply.js";

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

test("parseArgs reads --target and a comma-separated --paths", () => {
  const args = parseArgs(["--target", "wyrdli", "--paths", "a.ts,b.ts"]);
  assert.equal(args.target, "wyrdli");
  assert.deepEqual(args.paths, ["a.ts", "b.ts"]);
  assert.equal(args.dryRun, false);
});

test("parseArgs accepts space-separated paths and --dry-run", () => {
  const args = parseArgs(["--target", "wyrdli", "--paths", "a.ts", "b.ts", "--dry-run"]);
  assert.deepEqual(args.paths, ["a.ts", "b.ts"]);
  assert.equal(args.dryRun, true);
});

test("parseArgs accepts the --flag=value form", () => {
  const args = parseArgs(["--target=alpha", "--paths=a.ts,b.ts"]);
  assert.equal(args.target, "alpha");
  assert.deepEqual(args.paths, ["a.ts", "b.ts"]);
});

test("parseArgs returns null when required args are missing", () => {
  // The CLI must fail loudly rather than no-op: a silent success on a command
  // whose only job is to write files is the worst possible outcome.
  assert.equal(parseArgs([]), null);
  assert.equal(parseArgs(["--target", "wyrdli"]), null);
  assert.equal(parseArgs(["--paths", "a.ts"]), null);
});

test("refuses a path that escapes template/ and reports it as skipped", () => {
  // The path list is composed by a session reading the report; a malformed row
  // must not be able to write outside template/ and print "applied".
  const { repoRoot, target } = fixture();
  const result = applyPaths({ repoRoot, target, paths: ["../OUTSIDE.txt"] });
  assert.deepEqual(result.applied, []);
  assert.match(result.skipped[0].reason, /escapes/);
  assert.equal(fs.existsSync(path.join(repoRoot, "OUTSIDE.txt")), false);
  assert.equal(fs.existsSync(path.join(path.dirname(repoRoot), "OUTSIDE.txt")), false);
});

test("refuses an absolute path", () => {
  const { repoRoot, target } = fixture();
  const result = applyPaths({ repoRoot, target, paths: ["/etc/hosts"] });
  assert.deepEqual(result.applied, []);
  assert.equal(result.skipped.length, 1);
});

test("copies a binary byte-for-byte instead of re-encoding it as UTF-8", () => {
  // apply's binary list used to omit .onnx/.otf/.zip, so those files were read
  // as UTF-8, generalized and written back — 9 bytes in, 15 bytes out.
  const { repoRoot, target } = fixture();
  const bytes = Buffer.from([0x00, 0x89, 0x50, 0xff, 0xfe, 0x01, 0x02, 0x03, 0x04]);
  fs.writeFileSync(path.join(target.dir, "model.onnx"), bytes);
  applyPaths({ repoRoot, target, paths: ["model.onnx"] });
  const out = fs.readFileSync(path.join(repoRoot, "template/model.onnx"));
  assert.deepEqual(out, bytes, "binary content must survive apply unchanged");
});
