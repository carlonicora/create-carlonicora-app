import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import check, { comparePins } from "../checks/production-versions.js";

const registry = (versions) => async (name) => versions[name];

test("pins equal to the latest published releases produce no failure", async () => {
  const failures = await comparePins({ "@x/a": "1.2.3", "@x/b": "4.0.0" }, registry({ "@x/a": "1.2.3", "@x/b": "4.0.0" }));
  assert.deepEqual(failures, []);
});

test("a pin behind the latest release is reported with both versions", async () => {
  const failures = await comparePins({ "@x/a": "4.1.3" }, registry({ "@x/a": "4.17.3" }));
  assert.deepEqual(failures, ["versions.production.json pins @x/a@4.1.3, latest published is 4.17.3"]);
});

test("a package with no latest dist-tag is reported, not silently passed", async () => {
  const failures = await comparePins({ "@x/a": "1.0.0" }, registry({}));
  assert.deepEqual(failures, ['npm has no "latest" dist-tag for @x/a']);
});

test("an unreachable registry SKIPs instead of failing", async () => {
  const templateDir = fs.mkdtempSync(path.join(os.tmpdir(), "pins-"));
  fs.writeFileSync(path.join(templateDir, "versions.production.json"), '{"@x/a":"1.0.0"}');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  try {
    await assert.rejects(check.run({ templateDir }), (error) => error.code === "SKIP" && /offline/.test(error.message));
  } finally {
    globalThis.fetch = realFetch;
  }
});
