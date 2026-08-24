/**
 * Replace an app's own identifiers with the scaffolder's placeholders.
 *
 * `{{name}}` is the kebab-case project name ("my-app"); `{{display}}` is the
 * human-readable one ("My App"). They are DIFFERENT values — src/replacer.ts
 * substitutes each separately at scaffold time, so mixing them inside one
 * rendered file produces visibly inconsistent output.
 *
 * A plain-JS port of src/core-update/generalizer.ts, which stays in place for
 * the core-update feature. Keep the two in step if either changes.
 */

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Highest priority first: the most specific patterns must win. */
function patternsFor(appName) {
  const a = appName;
  return [
    [`${a}-api`, "{{name}}-api"],
    [`${a}-web`, "{{name}}-web"],
    [`@${a}/shared`, "@{{name}}/shared"],
    [`api.${a}.test`, "api.{{name}}.test"],
    [`minio.${a}.test`, "minio.{{name}}.test"],
    [`${a}.test`, "{{name}}.test"],
    [`admin@${a}.com`, "admin@{{name}}.com"],
    [`info@${a}.com`, "info@{{name}}.com"],
    [`${a}_SECRET`, "{{name}}_SECRET"],
    [`NEO4J_DATABASE=${a}`, "NEO4J_DATABASE={{name}}"],
    [`REDIS_QUEUE=${a}`, "REDIS_QUEUE={{name}}"],
    [`${a}-web#build`, "{{name}}-web#build"],
    [`/${a}-logo`, "/{{name}}-logo"],
    [`${a}-logo`, "{{name}}-logo"],
  ];
}

export function generalize(content, appName, options = {}) {
  if (!appName) throw new TypeError("generalize requires an appName");
  let result = content;

  // Declared domains first, and longest-first so "api.wyrd.li" cannot be left
  // as "api.{{name}}" by an earlier match on "wyrd.li".
  //
  // A project's domain is NOT derivable from its package name — wyrdli ships on
  // wyrd.li — so it has to be declared per target in template.sources.json.
  // Without this the word-boundary fallback below sails straight past it and
  // the donor's live domain lands in every scaffolded app.
  const domains = (options.domains ?? []).filter(Boolean).sort((a, b) => b.length - a.length);
  for (const domain of domains) {
    result = result.split(domain).join("{{name}}.com");
  }

  for (const [search, replace] of patternsFor(appName)) {
    result = result.split(search).join(replace);
  }
  // Word-boundary fallback, case-insensitive: catches bare occurrences the
  // specific patterns missed. Runs LAST so it cannot pre-empt them.
  return result.replace(new RegExp(`\\b${escapeRegExp(appName)}\\b`, "gi"), "{{name}}");
}
