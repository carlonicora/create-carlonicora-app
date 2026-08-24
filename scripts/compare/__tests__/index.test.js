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

test("an UNTRACKED file in a target is never offered as a candidate", () => {
  // The census walked the target's working tree, so .env, .env.prod.local and
  // playwright/.auth/user.json were all presented as adoption candidates.
  // Adopting one copies a live secret into template/, which package.json's
  // `files` array publishes to npm.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cmp-untracked-"));
  const repoRoot = path.join(root, "bootstrapper");
  write(path.join(repoRoot, "template/kept.ts"), "kept");
  gitRepo(path.join(root, "alpha"), { "tracked.ts": "yes", ".gitignore": ".env\n" }, "alpha");
  // Written AFTER the commit, and gitignored: never tracked.
  write(path.join(root, "alpha/.env"), "SECRET=hunter2");
  write(path.join(root, "alpha/untracked.ts"), "not committed");
  write(
    path.join(repoRoot, "template.sources.json"),
    JSON.stringify({ targets: [{ name: "alpha", path: "../alpha", appName: "alpha" }] }),
  );

  const { rows } = compareTemplate({ repoRoot });
  const paths = rows.map((r) => r.rel);
  assert.ok(paths.includes("tracked.ts"), "a tracked file must still be offered");
  assert.equal(paths.includes(".env"), false, "an untracked secret must never be a candidate");
  assert.equal(paths.includes("env"), false, "nor under its undotted template name");
  assert.equal(paths.includes("untracked.ts"), false, "nor any other untracked file");
});

test("a binary that differs between template and target is not ALIGNED", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cmp-bin-"));
  const repoRoot = path.join(root, "bootstrapper");
  fs.mkdirSync(path.join(repoRoot, "template"), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, "template/logo.png"), Buffer.from([0x89, 0x50, 1, 2, 3]));
  gitRepo(path.join(root, "alpha"), { "placeholder.txt": "x" }, "alpha");
  fs.writeFileSync(path.join(root, "alpha/logo.png"), Buffer.from([0x89, 0x50, 9, 9, 9, 9]));
  execFileSync("git", ["add", "-A"], { cwd: path.join(root, "alpha"), env: { ...process.env,
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@e.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@e.com" } });
  execFileSync("git", ["commit", "-q", "-m", "logo"], { cwd: path.join(root, "alpha"), env: { ...process.env,
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@e.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@e.com" } });
  write(
    path.join(repoRoot, "template.sources.json"),
    JSON.stringify({ targets: [{ name: "alpha", path: "../alpha", appName: "alpha" }] }),
  );

  const { rows } = compareTemplate({ repoRoot });
  assert.equal(find(rows, "logo.png").classification, "TARGET_AHEAD", "differing binaries must not read as ALIGNED");
});

test("an identical binary IS aligned", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cmp-bin2-"));
  const repoRoot = path.join(root, "bootstrapper");
  const bytes = Buffer.from([0x89, 0x50, 7, 7, 7]);
  fs.mkdirSync(path.join(repoRoot, "template"), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, "template/logo.png"), bytes);
  gitRepo(path.join(root, "alpha"), { "placeholder.txt": "x" }, "alpha");
  fs.writeFileSync(path.join(root, "alpha/logo.png"), bytes);
  const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@e.com",
    GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@e.com" };
  execFileSync("git", ["add", "-A"], { cwd: path.join(root, "alpha"), env });
  execFileSync("git", ["commit", "-q", "-m", "logo"], { cwd: path.join(root, "alpha"), env });
  write(
    path.join(repoRoot, "template.sources.json"),
    JSON.stringify({ targets: [{ name: "alpha", path: "../alpha", appName: "alpha" }] }),
  );
  const { rows } = compareTemplate({ repoRoot });
  assert.equal(find(rows, "logo.png").classification, "ALIGNED");
});

test("the report records when it was generated", () => {
  const { json } = compareTemplate({ repoRoot: fixture() });
  assert.match(json.meta.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
});
