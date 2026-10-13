import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import check, { compareRulebook, parseCopy } from "../checks/rulebook-sync.js";

const write = (file, body) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
};

const header = (version) =>
  `---\ntitle: X\nsection: 02-framework\n---\n\n<!-- Copied verbatim from the nja plugin, skill nja-architecture, version ${version}, on 2026-10-14. Do not edit here. -->\n\n`;

/** A fake nja references tree and rulebook, built from { name: [pluginBody, copyBody | null] }. */
function fixture(files, { version = "1.21.0", copyVersion = version } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rulebook-"));
  const referencesDir = path.join(root, "refs");
  const rulebookDir = path.join(root, "rulebook");
  write(path.join(rulebookDir, "README.md"), "authored, never compared");
  for (const [name, [plugin, copy]] of Object.entries(files)) {
    if (plugin !== null) write(path.join(referencesDir, name), plugin);
    if (copy !== null) write(path.join(rulebookDir, name), header(copyVersion) + copy);
  }
  return { referencesDir, rulebookDir, pluginVersion: version };
}

test("parseCopy returns the header version and the body below the comment", () => {
  assert.deepEqual(parseCopy(header("1.2.3") + "# Body\n"), { version: "1.2.3", body: "# Body\n" });
  assert.equal(parseCopy("# no header"), null);
});

test("identical copies at the plugin's version pass", () => {
  assert.deepEqual(compareRulebook(fixture({ "a.md": ["# A\n", "# A\n"], "frontend/b.md": ["# B\n", "# B\n"] })), []);
});

test("a copy whose body drifted from the plugin fails with the first differing line", () => {
  const failures = compareRulebook(fixture({ "a.md": ["# A\nnew rule\n", "# A\nold rule\n"] }));
  assert.deepEqual(failures, ["a.md: differs from the plugin (first difference at body line 2)"]);
});

test("a copy stamped with an older plugin version fails", () => {
  const failures = compareRulebook(fixture({ "a.md": ["# A\n", "# A\n"] }, { copyVersion: "1.20.0" }));
  assert.deepEqual(failures, ["a.md: header names nja 1.20.0, the plugin is at 1.21.0"]);
});

test("a new plugin reference with no copy fails, and so does a copy the plugin dropped", () => {
  const failures = compareRulebook(fixture({ "new.md": ["# N\n", null], "gone.md": [null, "# G\n"] }));
  assert.deepEqual(failures.sort(), [
    "gone.md: copied in the rulebook but no longer in the plugin",
    "new.md: in the plugin but not copied into the rulebook",
  ]);
});

test("a declared redaction is applied before comparing, and a stale one fails", () => {
  const files = { "t.md": ["values (a360ai x)\n", "values (x)\n"] };
  const redactions = { "t.md": [{ from: "values (a360ai x)", to: "values (x)" }] };
  assert.deepEqual(compareRulebook({ ...fixture(files), redactions }), []);

  const stale = { "t.md": [{ from: "text the plugin no longer has", to: "y" }] };
  const failures = compareRulebook({ ...fixture({ "t.md": ["values (x)\n", "values (x)\n"] }), redactions: stale });
  assert.deepEqual(failures, ['t.md: declared redaction no longer matches the plugin text: "text the plugin no longer has"']);
});

test("a missing nja checkout SKIPs instead of failing", () => {
  assert.throws(
    () => check.run({ repoRoot: os.tmpdir(), templateDir: os.tmpdir(), config: { nja: "./no-such-nja" } }),
    (error) => error.code === "SKIP",
  );
});
