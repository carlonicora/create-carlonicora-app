import fs from "fs";
import path from "path";
import { walk } from "../lib/walk.js";

/**
 * template/docs/handbook/02-framework/rulebook/ holds verbatim copies of the nja
 * plugin's nja-architecture references, so a generated app carries its rules
 * without the plugin. A copy nobody re-syncs drifts silently: 19 of 20 had, within
 * a month of being taken. This check fails the day the plugin moves on.
 *
 * Both directions: every plugin reference has a copy, and every copy still has a
 * plugin reference. Each copy's body must equal the plugin file, after the
 * redactions declared in integrity.config.json, and its header must name the
 * plugin's current version.
 */
const RULEBOOK = "docs/handbook/02-framework/rulebook";
const REFERENCES = "nja/skills/nja-architecture/references";
const PLUGIN_JSON = "nja/.claude-plugin/plugin.json";

/** Splits a copy into the version its header names and the verbatim body below it. */
export function parseCopy(source) {
  const lines = source.split("\n");
  const at = lines.findIndex((line) => line.startsWith("<!-- Copied"));
  if (at === -1) return null;
  const version = lines[at].match(/version (\d+\.\d+\.\d+)/)?.[1] ?? null;
  const rest = lines.slice(at + 1);
  if (rest[0] === "") rest.shift();
  return { version, body: rest.join("\n") };
}

/** Applies the declared redactions; a redaction that no longer matches is itself a failure. */
export function redact(body, redactions = []) {
  const stale = [];
  for (const { from, to } of redactions) {
    if (body.includes(from)) body = body.replace(from, to);
    else stale.push(from);
  }
  return { body, stale };
}

function firstDifference(a, b) {
  const left = a.split("\n");
  const right = b.split("\n");
  for (let i = 0; i < Math.max(left.length, right.length); i++) if (left[i] !== right[i]) return i + 1;
  return null;
}

export function compareRulebook({ rulebookDir, referencesDir, pluginVersion, redactions = {} }) {
  const failures = [];
  const rel = (root) => (file) => path.relative(root, file).split(path.sep).join("/");
  const sources = walk(referencesDir).filter((f) => f.endsWith(".md")).map(rel(referencesDir));
  const copies = walk(rulebookDir)
    .filter((f) => f.endsWith(".md"))
    .map(rel(rulebookDir))
    .filter((f) => f !== "README.md");

  for (const name of sources.filter((s) => !copies.includes(s)))
    failures.push(`${name}: in the plugin but not copied into the rulebook`);
  for (const name of copies.filter((c) => !sources.includes(c)))
    failures.push(`${name}: copied in the rulebook but no longer in the plugin`);

  for (const name of sources.filter((s) => copies.includes(s))) {
    const copy = parseCopy(fs.readFileSync(path.join(rulebookDir, name), "utf8"));
    if (!copy) {
      failures.push(`${name}: no "<!-- Copied … -->" header, so the copy cannot be compared`);
      continue;
    }
    if (copy.version !== pluginVersion)
      failures.push(`${name}: header names nja ${copy.version}, the plugin is at ${pluginVersion}`);

    const { body, stale } = redact(fs.readFileSync(path.join(referencesDir, name), "utf8"), redactions[name]);
    for (const from of stale) failures.push(`${name}: declared redaction no longer matches the plugin text: "${from}"`);
    if (body !== copy.body)
      failures.push(`${name}: differs from the plugin (first difference at body line ${firstDifference(copy.body, body)})`);
  }
  return failures;
}

export default {
  id: "rulebook-sync",
  title: "the handbook rulebook copies match the nja plugin",
  run({ repoRoot, templateDir, config }) {
    const njaRoot = config.nja ? path.resolve(repoRoot, config.nja) : null;
    if (!njaRoot || !fs.existsSync(path.join(njaRoot, PLUGIN_JSON))) {
      const error = new Error(`nja checkout not found (integrity.config.json "nja": ${config.nja ?? "unset"})`);
      error.code = "SKIP";
      throw error;
    }
    const rulebookDir = path.join(templateDir, RULEBOOK);
    if (!fs.existsSync(rulebookDir)) return [`expected directory is missing: ${RULEBOOK}. This check inspected nothing.`];

    return compareRulebook({
      rulebookDir,
      referencesDir: path.join(njaRoot, REFERENCES),
      pluginVersion: JSON.parse(fs.readFileSync(path.join(njaRoot, PLUGIN_JSON), "utf8")).version,
      redactions: config.rulebookRedactions,
    });
  },
};
