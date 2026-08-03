#!/usr/bin/env node
/**
 * Translation Validation Script
 *
 * Validates that all translation keys used in the codebase exist in the translation files.
 * Reports missing keys as errors with file locations.
 *
 * Usage: pnpm validate-translations
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MESSAGES_PATH = path.join(__dirname, "../messages/en.json");
const SRC_PATH = path.join(__dirname, "../src");
const PACKAGES_PATH = path.join(__dirname, "../../../packages");

// Patterns to match translation usage
const USE_TRANSLATIONS_PATTERN = /useTranslations\(\s*["']([^"']*)["']\s*\)/g;
const USE_TRANSLATIONS_NO_NS_PATTERN = /useTranslations\(\s*\)/g;
const T_CALL_PATTERN = /\bt\(\s*[`"']([^`"']+)[`"']/g;
const GET_TRANSLATIONS_PATTERN = /getTranslations\(\s*["']([^"']*)["']\s*\)/g;

/**
 * Recursively get all keys from a nested object
 */
function getAllKeys(obj, prefix = "") {
  const keys = new Set();

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const nestedKeys = getAllKeys(value, fullKey);
      nestedKeys.forEach((k) => keys.add(k));
    } else {
      keys.add(fullKey);
    }
  }

  return keys;
}

/**
 * Check if a key exists in the translations (including partial namespace matches)
 */
function keyExists(key, validKeys) {
  if (validKeys.has(key)) {
    return true;
  }

  // Check if key is a valid namespace prefix (for dynamic keys)
  for (const validKey of validKeys) {
    if (validKey.startsWith(key + ".")) {
      return true;
    }
  }

  return false;
}

/**
 * Extract translation keys from a single file
 */
function extractKeysFromFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const usages = [];

  // Find all useTranslations calls with namespaces in this file
  const namespaces = [];

  // Match useTranslations("namespace")
  let match;
  const contentForNamespace = content;

  // Reset regex
  USE_TRANSLATIONS_PATTERN.lastIndex = 0;
  while ((match = USE_TRANSLATIONS_PATTERN.exec(contentForNamespace)) !== null) {
    const lineNumber = content.substring(0, match.index).split("\n").length;
    namespaces.push({ namespace: match[1], line: lineNumber });
  }

  // Match useTranslations() without namespace
  USE_TRANSLATIONS_NO_NS_PATTERN.lastIndex = 0;
  while ((match = USE_TRANSLATIONS_NO_NS_PATTERN.exec(contentForNamespace)) !== null) {
    const lineNumber = content.substring(0, match.index).split("\n").length;
    namespaces.push({ namespace: "", line: lineNumber });
  }

  // Match getTranslations("namespace") for server components
  GET_TRANSLATIONS_PATTERN.lastIndex = 0;
  while ((match = GET_TRANSLATIONS_PATTERN.exec(contentForNamespace)) !== null) {
    const lineNumber = content.substring(0, match.index).split("\n").length;
    namespaces.push({ namespace: match[1], line: lineNumber });
  }

  // If no useTranslations found but t() is used, assume no namespace
  if (namespaces.length === 0) {
    namespaces.push({ namespace: "", line: 0 });
  }

  // Find all t("key") calls
  T_CALL_PATTERN.lastIndex = 0;
  while ((match = T_CALL_PATTERN.exec(content)) !== null) {
    const key = match[1];
    const lineNumber = content.substring(0, match.index).split("\n").length;

    // Skip dynamic keys (containing variables)
    if (key.includes("${") || key.includes("{")) {
      continue;
    }

    // Find the closest namespace declaration before this t() call
    let activeNamespace = "";
    for (const ns of namespaces) {
      if (ns.line <= lineNumber) {
        activeNamespace = ns.namespace;
      }
    }

    // Build full key
    const fullKey = activeNamespace ? `${activeNamespace}.${key}` : key;

    usages.push({
      key: fullKey,
      file: filePath,
      line: lineNumber,
    });
  }

  return usages;
}

/**
 * Recursively find all TypeScript/JavaScript files
 */
function findSourceFiles(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === "coverage" ||
        entry.name === "__tests__" ||
        entry.name === "tests"
      ) {
        continue;
      }
      findSourceFiles(fullPath, files);
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.tsx") &&
      !entry.name.endsWith(".spec.ts") &&
      !entry.name.endsWith(".spec.tsx") &&
      !entry.name.endsWith(".d.ts")
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Main validation function
 */
function validateTranslations() {
  if (!fs.existsSync(MESSAGES_PATH)) {
    console.error(`Error: Translation file not found at ${MESSAGES_PATH}`);
    process.exit(1);
  }

  const translations = JSON.parse(fs.readFileSync(MESSAGES_PATH, "utf-8"));
  const validKeys = getAllKeys(translations);

  console.log(`Loaded ${validKeys.size} translation keys from en.json\n`);

  const sourceFiles = [
    ...findSourceFiles(SRC_PATH),
    ...findSourceFiles(path.join(PACKAGES_PATH, "nextjs-jsonapi/src")),
  ];

  console.log(`Scanning ${sourceFiles.length} source files...\n`);

  const allUsages = [];

  for (const file of sourceFiles) {
    const usages = extractKeysFromFile(file);
    allUsages.push(...usages);
  }

  const missingKeys = [];
  const checkedKeys = new Set();

  for (const usage of allUsages) {
    checkedKeys.add(usage.key);

    if (!keyExists(usage.key, validKeys)) {
      missingKeys.push(usage);
    }
  }

  return {
    missingKeys,
    totalKeysChecked: checkedKeys.size,
  };
}

// Run validation
const result = validateTranslations();

console.log(`Checked ${result.totalKeysChecked} unique translation keys\n`);

if (result.missingKeys.length > 0) {
  console.error("Missing translation keys found:\n");

  const byFile = new Map();
  for (const missing of result.missingKeys) {
    const existing = byFile.get(missing.file) || [];
    existing.push(missing);
    byFile.set(missing.file, existing);
  }

  for (const [file, usages] of byFile) {
    const relativePath = path.relative(process.cwd(), file);
    console.error(`  ${relativePath}:`);
    for (const usage of usages) {
      console.error(`    Line ${usage.line}: "${usage.key}"`);
    }
    console.error("");
  }

  console.error(`Total: ${result.missingKeys.length} missing key(s)\n`);
  process.exit(1);
} else {
  console.log("All translation keys are valid!\n");
  process.exit(0);
}
