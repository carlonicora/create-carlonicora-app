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
