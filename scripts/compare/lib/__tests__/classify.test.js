import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyRow, CLASSIFICATIONS } from "../classify.js";

const target = (name, body, { date = 1000, subject = "s", bulk = false } = {}) => ({
  name,
  present: body !== null,
  body,
  git: body === null ? null : { date, subject, bulk },
});

const base = { rel: "a.ts", inTemplate: true, templateBody: "T", neverAdopt: [], templateOnly: [] };

test("every classification is a known constant", () => {
  const row = classifyRow({ ...base, targets: [target("w", "T")] });
  assert.ok(CLASSIFICATIONS.includes(row.classification));
});

test("all present targets equal to the template is ALIGNED", () => {
  const row = classifyRow({ ...base, targets: [target("w", "T"), target("n", "T")] });
  assert.equal(row.classification, "ALIGNED");
  assert.equal(row.winner, null);
});

test("exactly one differing target is TARGET_AHEAD and names the winner", () => {
  const row = classifyRow({ ...base, targets: [target("w", "X"), target("n", "T")] });
  assert.equal(row.classification, "TARGET_AHEAD");
  assert.equal(row.winner, "w");
});

test("two differing targets is DIVERGED", () => {
  const row = classifyRow({ ...base, targets: [target("w", "X"), target("n", "Y")] });
  assert.equal(row.classification, "DIVERGED");
});

test("absent from the template but present in a target is TARGET_ONLY", () => {
  const row = classifyRow({ ...base, inTemplate: false, templateBody: null, targets: [target("w", "X")] });
  assert.equal(row.classification, "TARGET_ONLY");
  assert.equal(row.winner, "w");
});

test("present in the template and no target is TEMPLATE_ONLY", () => {
  const row = classifyRow({ ...base, targets: [target("w", null)] });
  assert.equal(row.classification, "TEMPLATE_ONLY");
});

test("an explicit templateOnly path stays TEMPLATE_ONLY even when a target has it", () => {
  const row = classifyRow({ ...base, templateOnly: ["a.ts"], targets: [target("w", "X")] });
  assert.equal(row.classification, "TEMPLATE_ONLY");
});

test("neverAdopt wins over everything, including a differing target", () => {
  const row = classifyRow({ ...base, neverAdopt: ["a.ts"], targets: [target("w", "X")] });
  assert.equal(row.classification, "NEVER_ADOPT");
});

test("neverAdopt matches a whole subtree by prefix", () => {
  const row = classifyRow({
    ...base,
    rel: "apps/api/src/neo4j.migrations/001.ts",
    neverAdopt: ["apps/api/src/neo4j.migrations"],
    targets: [target("w", "X")],
  });
  assert.equal(row.classification, "NEVER_ADOPT");
});

test("a non-bulk target outranks a NEWER bulk one", () => {
  // This is the rule the whole design turns on: a rename sweep that touched
  // the file yesterday must not beat a real edit from last week.
  const row = classifyRow({
    ...base,
    targets: [
      target("bulky", "X", { date: 9999, bulk: true, subject: "chore: rename everything" }),
      target("real", "Y", { date: 1000, bulk: false, subject: "feat: actually change it" }),
    ],
  });
  assert.equal(row.classification, "DIVERGED");
  assert.equal(row.winner, "real", "non-bulk must outrank a newer bulk commit");
});

test("when every candidate is bulk the newest wins but the flag is preserved", () => {
  const row = classifyRow({
    ...base,
    targets: [
      target("older", "X", { date: 1000, bulk: true }),
      target("newer", "Y", { date: 5000, bulk: true }),
    ],
  });
  assert.equal(row.winner, "newer");
  assert.equal(row.targets.every((t) => t.bulk), true, "bulk must stay visible so the hint reads as weak");
});

test("row always carries every target, present or not", () => {
  const row = classifyRow({ ...base, targets: [target("w", "X"), target("n", null)] });
  assert.equal(row.targets.length, 2);
  assert.equal(row.targets.find((t) => t.name === "n").present, false);
});

test("templateOnly wins even when the template does not yet have the file", () => {
  // The templateOnly check used to sit AFTER the !inTemplate branch, so a
  // declared templateOnly subtree the template lacked leaked out as
  // TARGET_ONLY — observed live on apps/web/src/features/pwa.
  const row = classifyRow({
    ...base,
    rel: "apps/web/src/features/pwa/utils/platform.ts",
    inTemplate: false,
    templateBody: null,
    templateOnly: ["apps/web/src/features/pwa"],
    targets: [target("n", "X")],
  });
  assert.equal(row.classification, "TEMPLATE_ONLY");
  assert.equal(row.winner, null);
});

test("neverAdopt still outranks templateOnly", () => {
  const row = classifyRow({ ...base, neverAdopt: ["a.ts"], templateOnly: ["a.ts"], targets: [target("w", "X")] });
  assert.equal(row.classification, "NEVER_ADOPT");
});

test("a target with NO git history ranks below one with a real bulk commit", () => {
  // bulk defaults to false when git data is absent, which put "no evidence" on
  // the winning side of the comparator that exists to discount weak evidence.
  const withoutGit = { name: "nohistory", present: true, body: "X", git: null };
  const withBulk = target("dated", "Y", { date: 1000, bulk: true });
  const row = classifyRow({ ...base, targets: [withoutGit, withBulk] });
  assert.equal(row.classification, "DIVERGED");
  assert.equal(row.winner, "dated", "unknown history is the weakest evidence, not the strongest");
});

test("between two unknown-history targets a winner is still named", () => {
  const a = { name: "a", present: true, body: "X", git: null };
  const b = { name: "b", present: true, body: "Y", git: null };
  assert.ok(["a", "b"].includes(classifyRow({ ...base, targets: [a, b] }).winner));
});
