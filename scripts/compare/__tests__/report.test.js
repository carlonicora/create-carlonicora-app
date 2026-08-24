import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown, renderJson } from "../report.js";

const row = (rel, classification, targets, winner = null) => ({ rel, classification, winner, targets });
const t = (name, { present = true, equal = false, date = 1755000000, bulk = false } = {}) => ({
  name,
  present,
  equal,
  date,
  subject: "s",
  bulk,
});

test("markdown lists judgement-needed groups before ALIGNED", () => {
  const md = renderMarkdown([
    row("a", "ALIGNED", [t("w", { equal: true })]),
    row("b", "DIVERGED", [t("w"), t("n")]),
  ]);
  assert.ok(md.indexOf("## DIVERGED") < md.indexOf("## ALIGNED"), "DIVERGED must precede ALIGNED");
});

test("markdown omits empty groups", () => {
  const md = renderMarkdown([row("a", "ALIGNED", [t("w", { equal: true })])]);
  assert.doesNotMatch(md, /## DIVERGED/);
});

test("markdown marks a bulk target so the hint reads as weak", () => {
  const md = renderMarkdown([row("a", "TARGET_AHEAD", [t("w", { bulk: true })], "w")]);
  assert.match(md, /\(bulk\)/);
});

test("markdown shows an absent target explicitly", () => {
  const md = renderMarkdown([row("a", "TEMPLATE_ONLY", [t("w", { present: false })])]);
  assert.match(md, /w: absent/);
});

test("markdown renders a date as an ISO day and handles a null date", () => {
  const md = renderMarkdown([row("a", "TARGET_AHEAD", [{ ...t("w"), date: null }], "w")]);
  assert.match(md, /—/);
});

test("markdown states that winner is a hint, not a decision", () => {
  const md = renderMarkdown([row("a", "ALIGNED", [t("w", { equal: true })])]);
  assert.match(md, /hint/i);
});

test("json carries per-classification counts and the rows", () => {
  const rows = [row("a", "ALIGNED", [t("w", { equal: true })]), row("b", "DIVERGED", [t("w"), t("n")])];
  const json = renderJson(rows, { targets: ["w", "n"] });
  assert.equal(json.meta.total, 2);
  assert.equal(json.meta.counts.ALIGNED, 1);
  assert.equal(json.meta.counts.DIVERGED, 1);
  assert.equal(json.rows.length, 2);
});

test("json is serialisable", () => {
  const json = renderJson([row("a", "ALIGNED", [t("w", { equal: true })])], {});
  assert.doesNotThrow(() => JSON.stringify(json));
});

test("empty input produces a valid report rather than throwing", () => {
  assert.doesNotThrow(() => renderMarkdown([]));
  assert.equal(renderJson([]).meta.total, 0);
});
