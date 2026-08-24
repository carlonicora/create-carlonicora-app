import { test } from "node:test";
import assert from "node:assert/strict";
import { generalize } from "../generalize.js";

test("specific patterns beat the word-boundary fallback", () => {
  assert.equal(generalize("wyrdli-api", "wyrdli"), "{{name}}-api");
  assert.equal(generalize("@wyrdli/shared", "wyrdli"), "@{{name}}/shared");
  assert.equal(generalize("api.wyrdli.test", "wyrdli"), "api.{{name}}.test");
});

test("bare occurrences fall back to {{name}}", () => {
  assert.equal(generalize("welcome to wyrdli", "wyrdli"), "welcome to {{name}}");
});

test("fallback is case-insensitive", () => {
  assert.equal(generalize("Wyrdli", "wyrdli"), "{{name}}");
});

test("does not touch unrelated words containing the app name", () => {
  // \b prevents a substring match inside a longer identifier.
  assert.equal(generalize("wyrdlicious", "wyrdli"), "wyrdlicious");
});

test("handles a hyphenated app name without regex breakage", () => {
  assert.equal(generalize("neural-erp-web", "neural-erp"), "{{name}}-web");
  assert.equal(generalize("a neural-erp thing", "neural-erp"), "a {{name}} thing");
});

test("is a no-op when the app name does not occur", () => {
  assert.equal(generalize("nothing to see", "wyrdli"), "nothing to see");
});

test("throws rather than silently mangling when appName is empty", () => {
  assert.throws(() => generalize("x", ""), TypeError);
});

test("a declared domain is generalized — the app name alone does not catch it", () => {
  // wyrdli ships on wyrd.li: the domain is not derivable from the package name,
  // which is why it must be declared. Without this the live domain leaks into
  // every scaffolded app.
  assert.equal(generalize("https://wyrd.li/x", "wyrdli"), "https://wyrd.li/x");
  assert.equal(
    generalize("https://wyrd.li/x", "wyrdli", { domains: ["wyrd.li"] }),
    "https://{{name}}.com/x",
  );
});

test("longer domains win, so a subdomain is not left half-rewritten", () => {
  assert.equal(
    generalize("api.wyrd.li", "wyrdli", { domains: ["wyrd.li", "api.wyrd.li"] }),
    "{{name}}.com",
  );
});

test("no domains declared behaves exactly as before", () => {
  assert.equal(generalize("wyrdli-api", "wyrdli", {}), "{{name}}-api");
  assert.equal(generalize("wyrdli-api", "wyrdli"), "{{name}}-api");
});

test("an empty domain entry is ignored rather than replacing everything", () => {
  assert.equal(generalize("hello", "wyrdli", { domains: ["", null] }), "hello");
});

