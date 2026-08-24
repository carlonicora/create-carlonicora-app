import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readComparableBody, normaliseText, isBinaryFile, isOpaqueBody } from "../content.js";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "content-"));

const fileWith = (name, contents) => {
  const dir = tmp();
  const full = path.join(dir, name);
  fs.writeFileSync(full, contents);
  return full;
};

test("two DIFFERENT binaries produce different bodies", () => {
  // Both used to read as null, so `null === null` made every binary present in
  // both trees classify ALIGNED no matter how different it was.
  const a = fileWith("logo.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]));
  const b = fileWith("logo.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 9, 9, 9, 9]));
  const bodyA = readComparableBody(a);
  const bodyB = readComparableBody(b);
  assert.match(bodyA, /^sha256:/);
  assert.notEqual(bodyA, bodyB, "different binaries must not compare equal");
});

test("two IDENTICAL binaries produce the same body", () => {
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 4, 5, 6]);
  assert.equal(readComparableBody(fileWith("a.png", bytes)), readComparableBody(fileWith("b.png", bytes)));
});

test("an unlisted extension containing NUL is still treated as binary", () => {
  const weird = fileWith("model.bin", Buffer.from([0x00, 0x01, 0x02]));
  assert.equal(isBinaryFile(weird), true);
  assert.match(readComparableBody(weird), /^sha256:/);
});

test("a text file is returned as text, not a digest", () => {
  const body = readComparableBody(fileWith("a.ts", "const x = 1;\n"));
  assert.equal(body, "const x = 1;\n");
  assert.equal(isOpaqueBody(body), false);
});

test("two unreadable files never compare equal to each other", () => {
  const dirA = tmp();
  const dirB = tmp();
  // A directory is not a readable file; each must yield a distinct body.
  assert.notEqual(readComparableBody(dirA), readComparableBody(dirB));
});

test("normaliseText preserves indentation, so de-indented YAML is NOT equal", () => {
  // The collapse-all-whitespace version reported these as identical. The second
  // makes `steps` a sibling of `build` — a workflow that never runs the step.
  const correct = "jobs:\n  build:\n    steps:\n      - run: pnpm test\n";
  const broken = "jobs:\n  build:\n  steps:\n  - run: pnpm test\n";
  assert.notEqual(normaliseText(correct), normaliseText(broken));
});

test("normaliseText preserves newlines inside a template literal", () => {
  assert.notEqual(normaliseText("const p = `line one\nline two`;"), normaliseText("const p = `line one line two`;"));
});

test("normaliseText still ignores CRLF and trailing whitespace", () => {
  assert.equal(normaliseText("a\r\nb  \n  c\t\n"), normaliseText("a\nb\n  c\n"));
});

test("normaliseText leaves a digest body untouched", () => {
  assert.equal(normaliseText("sha256:abc"), "sha256:abc");
});

test("normaliseText maps null to null", () => {
  assert.equal(normaliseText(null), null);
});
