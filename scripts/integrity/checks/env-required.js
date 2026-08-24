import fs from "fs";
import path from "path";

/**
 * Keys a generated app cannot function without, each tied to a feature the
 * template ships. ENCRYPTION_KEY is not optional once the administration
 * AI-connections page exists: AiConnectionService throws
 * "ENCRYPTION_KEY is not configured — cannot store AI connection secrets".
 */
const REQUIRED = [
  "ENCRYPTION_KEY",
  "NEXT_PUBLIC_REGISTRATION_MODE",
  "CREDIT_COST",
  "CREDIT_MINIMUM",
];

/** Keys that were replaced and must not linger — two switches for one behaviour. */
const RETIRED = ["ALLOW_REGISTRATION", "NEXT_PUBLIC_ALLOW_REGISTRATION"];

export default {
  id: "env-required",
  title: "env.example declares every required key and no retired one",
  run({ templateDir }) {
    const source = fs.readFileSync(path.join(templateDir, "env.example"), "utf8");
    const declared = new Set([...source.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]));
    return [
      ...REQUIRED.filter((k) => !declared.has(k)).map((k) => `env.example is missing required key ${k}`),
      ...RETIRED.filter((k) => declared.has(k)).map((k) => `env.example still declares retired key ${k}`),
    ];
  },
};
