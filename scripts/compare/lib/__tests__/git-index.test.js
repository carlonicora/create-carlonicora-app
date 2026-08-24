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
