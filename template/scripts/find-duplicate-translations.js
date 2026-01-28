#!/usr/bin/env node

/**
 * Duplicate Translation Values Detection Script
 *
 * Scans apps/web/messages/en.json and reports translation keys
 * that have duplicate values.
 *
 * Usage: node scripts/find-duplicate-translations.js
 *
 * Exit codes:
 *   0 - No duplicates found
 *   1 - Duplicate values found
 */

const fs = require("fs");
const path = require("path");

// Configuration
const CONFIG = {
  messagesFile: "apps/web/messages/en.json",
};

// ANSI colors for terminal output
const colors = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

/**
 * Flatten nested JSON object to dot-notation keys
 * @param {object} obj - Nested JSON object
 * @param {string} prefix - Current key prefix
 * @returns {Map<string, string>} Map of key-value pairs
 */
function flattenMessages(obj, prefix = "") {
  const entries = new Map();

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const nestedEntries = flattenMessages(value, fullKey);
      nestedEntries.forEach((v, k) => entries.set(k, v));
    } else {
      entries.set(fullKey, value);
    }
  }

  return entries;
}

/**
 * Find duplicate values in the translations
 * @param {Map<string, string>} entries - Map of key-value pairs
 * @returns {Map<string, string[]>} Map of duplicate values to their keys
 */
function findDuplicates(entries) {
  const valueToKeys = new Map();

  for (const [key, value] of entries.entries()) {
    if (!valueToKeys.has(value)) {
      valueToKeys.set(value, []);
    }
    valueToKeys.get(value).push(key);
  }

  const duplicates = new Map();
  for (const [value, keys] of valueToKeys.entries()) {
    if (keys.length > 1) {
      duplicates.set(value, keys);
    }
  }

  return duplicates;
}

/**
 * Main validation function
 */
function findDuplicateTranslations() {
  const projectRoot = process.cwd();

  console.info(colors.bold("\n=== Duplicate Translation Values Report ===\n"));

  const messagesPath = path.join(projectRoot, CONFIG.messagesFile);
  if (!fs.existsSync(messagesPath)) {
    console.error(colors.red(`Error: Messages file not found: ${messagesPath}`));
    process.exit(1);
  }

  const messagesJson = JSON.parse(fs.readFileSync(messagesPath, "utf-8"));
  const entries = flattenMessages(messagesJson);

  console.info(
    colors.gray(`Loaded ${entries.size} translation keys from en.json\n`)
  );

  const duplicates = findDuplicates(entries);

  if (duplicates.size === 0) {
    console.info(colors.green("No duplicate translation values found.\n"));
    console.info(colors.gray("-".repeat(60)));
    console.info(colors.bold("\nSUMMARY:"));
    console.info(`  - Total translation keys: ${entries.size}`);
    console.info(`  - Duplicate values: ${colors.green(0)}`);
    console.info(colors.green("\nExit code: 0 (no duplicates)\n"));
    process.exit(0);
  }

  console.info(colors.red(colors.bold(`DUPLICATE VALUES (${duplicates.size} found):\n`)));
  console.info(colors.gray("-".repeat(60)));

  let totalDuplicateKeys = 0;

  for (const [value, keys] of duplicates.entries()) {
    totalDuplicateKeys += keys.length;
    console.info(colors.cyan(`\n  Value: "${value}"`));
    console.info(colors.gray(`  ${keys.length} keys share this value:\n`));

    for (const key of keys) {
      console.info(`    - ${colors.yellow(key)}`);
    }
  }

  console.info("");
  console.info(colors.gray("-".repeat(60)));
  console.info(colors.bold("\nSUMMARY:"));
  console.info(`  - Total translation keys: ${entries.size}`);
  console.info(`  - Unique duplicate values: ${colors.red(duplicates.size)}`);
  console.info(`  - Total keys involved in duplicates: ${colors.red(totalDuplicateKeys)}`);

  console.info(colors.red("\nExit code: 1 (duplicates found)\n"));
  process.exit(1);
}

findDuplicateTranslations();
