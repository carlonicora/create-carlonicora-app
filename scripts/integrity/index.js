import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const templateDir = path.join(repoRoot, "template");
const strict = process.argv.includes("--strict");

const configPath = path.join(repoRoot, "integrity.config.json");
const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {};

const checksDir = path.join(here, "checks");
const files = fs.existsSync(checksDir) ? fs.readdirSync(checksDir).filter((f) => f.endsWith(".js")).sort() : [];

let failed = 0;
let skipped = 0;

for (const file of files) {
  const check = (await import(path.join(checksDir, file))).default;
  let failures;
  try {
    failures = await check.run({ repoRoot, templateDir, config });
  } catch (error) {
    if (error && error.code === "SKIP") {
      skipped++;
      console.log(`SKIP  ${check.id} — ${error.message}`);
      continue;
    }
    throw error;
  }
  if (failures.length === 0) {
    console.log(`PASS  ${check.id} — ${check.title}`);
  } else {
    failed++;
    console.log(`FAIL  ${check.id} — ${check.title}`);
    for (const failure of failures) console.log(`        ${failure}`);
  }
}

if (skipped > 0 && strict) {
  console.log(`\n${skipped} check(s) skipped and --strict was passed.`);
  process.exit(1);
}
console.log(failed === 0 ? "\nAll template integrity checks passed." : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
