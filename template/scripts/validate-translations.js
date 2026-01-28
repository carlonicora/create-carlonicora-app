#!/usr/bin/env node

/**
 * Translation Key Validation Script
 *
 * Extracts all translation keys from the codebase and compares them
 * against apps/web/messages/en.json to find missing translations
 * and unused translation keys.
 *
 * Usage: node scripts/validate-translations.js
 *
 * Exit codes:
 *   0 - All translation keys are valid (unused keys are warnings only)
 *   1 - Missing translations found
 */

const fs = require("fs");
const path = require("path");

// Configuration
const CONFIG = {
  messagesFile: "apps/web/messages/en.json",
  scanDirs: ["apps/web/src", "packages/nextjs-jsonapi/src"],
  extensions: [".ts", ".tsx"],
  exclude: [
    "__tests__",
    ".test.",
    ".spec.",
    "template.ts",
    "vitest.setup.ts",
    "/testing/",
    "/scripts/",
  ],
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
 * @returns {Set<string>} Set of flattened keys
 */
function flattenMessages(obj, prefix = "") {
  const keys = new Set();

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      // Recurse into nested objects
      const nestedKeys = flattenMessages(value, fullKey);
      nestedKeys.forEach((k) => keys.add(k));
    } else {
      // Leaf node - add the key
      keys.add(fullKey);
    }
  }

  return keys;
}

/**
 * Recursively get all files with specified extensions
 * @param {string} dir - Directory to scan
 * @param {string[]} extensions - File extensions to include
 * @param {string[]} exclude - Patterns to exclude
 * @returns {string[]} Array of file paths
 */
function getFiles(dir, extensions, exclude) {
  const files = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    // Check exclusions
    if (exclude.some((pattern) => fullPath.includes(pattern))) {
      continue;
    }

    if (item.isDirectory()) {
      files.push(...getFiles(fullPath, extensions, exclude));
    } else if (extensions.some((ext) => item.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Extract namespace from useTranslations() or getTranslations() call
 * @param {string} content - File content
 * @returns {string|null} Namespace or null if none specified
 */
function extractNamespace(content) {
  // Match useTranslations("namespace") or useTranslations('namespace')
  const useTransMatch = content.match(
    /useTranslations\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/
  );
  if (useTransMatch) {
    return useTransMatch[1];
  }

  // Match getTranslations("namespace")
  const getTransMatch = content.match(
    /getTranslations\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/
  );
  if (getTransMatch) {
    return getTransMatch[1];
  }

  return null;
}

/**
 * Extract translation keys from file content
 * @param {string} content - File content
 * @param {string|null} namespace - Namespace prefix
 * @returns {{static: Array<{key: string, line: number}>, dynamic: Array<{key: string, line: number}>}}
 */
function extractTranslationKeys(content, namespace) {
  const staticKeys = [];
  const dynamicKeys = [];

  // First, extract multiline variable ternary patterns from full content
  // Match: const/let/var key = condition ? "key1" : "key2" (across multiple lines)
  // Only match keys that look like translation keys (contain dots, e.g., "entity.action")
  const multilineVarTernaryRegex = /(?:const|let|var)\s+(\w*[Kk]ey\w*|translationKey)\s*=[\s\S]{0,200}?\?\s*["'`]([a-z_]+\.[a-z_.]+)["'`]\s*:\s*["'`]([a-z_]+\.[a-z_.]+)["'`]/g;
  let multiMatch;
  while ((multiMatch = multilineVarTernaryRegex.exec(content)) !== null) {
    const key1 = multiMatch[2];
    const key2 = multiMatch[3];
    // Find approximate line number
    const lineNum = content.substring(0, multiMatch.index).split("\n").length;
    const fullKey1 = namespace ? `${namespace}.${key1}` : key1;
    const fullKey2 = namespace ? `${namespace}.${key2}` : key2;
    staticKeys.push({ key: fullKey1, line: lineNum });
    staticKeys.push({ key: fullKey2, line: lineNum });
  }

  const lines = content.split("\n");

  // Regex patterns for t() and t.rich() calls
  // Match t("key"), t('key'), t(`key`), t.rich("key"), t.rich('key'), t.rich(`key`)
  const tCallRegex = /\bt(?:\.rich)?\s*\(\s*["'`]([^"'`]*?)["'`]/g;
  // Match t(`...${...}...`) or t.rich(`...${...}...`) - template literals with variables
  const templateRegex = /\bt(?:\.rich)?\s*\(\s*`([^`]*\$\{[^`]*)`/g;
  // Match ternary expressions: t(condition ? "key1" : "key2") - extract both keys
  // Only match keys that look like translation keys (contain dots)
  const ternaryRegex = /\bt\s*\([^)]+\?\s*["'`]([a-z_]+\.[a-z_.]+)["'`]\s*:\s*["'`]([a-z_]+\.[a-z_.]+)["'`]/g;
  // Match variable assignments with ternary: const key = condition ? "key1" : "key2"
  // Only match keys that look like translation keys (contain dots)
  const varTernaryRegex = /(?:const|let|var)\s+\w+\s*=\s*[^?]+\?\s*["'`]([a-z_]+\.[a-z_.]+)["'`]\s*:\s*["'`]([a-z_]+\.[a-z_.]+)["'`]/g;

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Extract template literals with variables (dynamic keys)
    let templateMatch;
    while ((templateMatch = templateRegex.exec(line)) !== null) {
      const rawKey = templateMatch[1];
      dynamicKeys.push({ key: rawKey, line: lineNum });
    }

    // Reset regex
    templateRegex.lastIndex = 0;

    // Extract ternary expression keys: t(condition ? "key1" : "key2")
    let ternaryMatch;
    while ((ternaryMatch = ternaryRegex.exec(line)) !== null) {
      const key1 = ternaryMatch[1];
      const key2 = ternaryMatch[2];
      const fullKey1 = namespace ? `${namespace}.${key1}` : key1;
      const fullKey2 = namespace ? `${namespace}.${key2}` : key2;
      staticKeys.push({ key: fullKey1, line: lineNum });
      staticKeys.push({ key: fullKey2, line: lineNum });
    }

    // Reset regex
    ternaryRegex.lastIndex = 0;

    // Extract variable ternary keys: const key = condition ? "key1" : "key2"
    let varTernaryMatch;
    while ((varTernaryMatch = varTernaryRegex.exec(line)) !== null) {
      const key1 = varTernaryMatch[1];
      const key2 = varTernaryMatch[2];
      const fullKey1 = namespace ? `${namespace}.${key1}` : key1;
      const fullKey2 = namespace ? `${namespace}.${key2}` : key2;
      staticKeys.push({ key: fullKey1, line: lineNum });
      staticKeys.push({ key: fullKey2, line: lineNum });
    }

    // Reset regex
    varTernaryRegex.lastIndex = 0;

    // Extract static keys
    let match;
    while ((match = tCallRegex.exec(line)) !== null) {
      const rawKey = match[1];

      // Skip if this is a dynamic key (contains ${})
      if (rawKey.includes("${")) {
        continue;
      }

      // Skip empty keys
      if (!rawKey.trim()) {
        continue;
      }

      // Build full key with namespace
      const fullKey = namespace ? `${namespace}.${rawKey}` : rawKey;

      staticKeys.push({ key: fullKey, line: lineNum });
    }

    // Reset regex for next line
    tCallRegex.lastIndex = 0;
  });

  return { static: staticKeys, dynamic: dynamicKeys };
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Extract dynamic key prefixes that should mark keys as "potentially used"
 * e.g., "entities.${variable}" means all "entities.*" keys are potentially used
 * @param {string} dynamicKey - Dynamic key pattern with ${...}
 * @returns {string[]} Array of prefixes that should be considered used
 */
function extractDynamicPrefixes(dynamicKey) {
  const prefixes = [];

  // Find the static prefix before the first ${
  const dollarIndex = dynamicKey.indexOf("${");
  if (dollarIndex > 0) {
    let prefix = dynamicKey.substring(0, dollarIndex);
    // Remove trailing dot if present
    if (prefix.endsWith(".")) {
      prefix = prefix.slice(0, -1);
    }
    if (prefix) {
      prefixes.push(prefix);
    }
  }

  return prefixes;
}

/**
 * Find suggestion for a missing key
 * @param {string} missingKey - The missing translation key
 * @param {Set<string>} validKeys - Set of valid keys
 * @returns {string|null} Suggested key or null
 */
function findSuggestion(missingKey, validKeys) {
  const validKeysArray = Array.from(validKeys);

  // Strategy 1: Check if key exists with additional segment in the middle
  // e.g., "auth.register" -> "auth.buttons.register"
  const parts = missingKey.split(".");
  if (parts.length >= 2) {
    const prefix = parts[0];
    const suffix = parts[parts.length - 1];

    // Look for keys that start with prefix and end with suffix
    const candidates = validKeysArray.filter(
      (k) => k.startsWith(prefix + ".") && k.endsWith("." + suffix)
    );

    if (candidates.length === 1) {
      return candidates[0];
    } else if (candidates.length > 1) {
      // Return the shortest match
      candidates.sort((a, b) => a.length - b.length);
      return candidates[0];
    }
  }

  // Strategy 2: Find closest by Levenshtein distance
  let bestMatch = null;
  let bestDistance = Infinity;

  // Only consider keys that share the same top-level namespace
  const topNamespace = missingKey.split(".")[0];
  const sameNamespaceKeys = validKeysArray.filter((k) =>
    k.startsWith(topNamespace + ".")
  );

  for (const validKey of sameNamespaceKeys) {
    const distance = levenshteinDistance(missingKey, validKey);

    // Only suggest if distance is reasonable (less than 40% of key length)
    const threshold = Math.max(missingKey.length, validKey.length) * 0.4;

    if (distance < bestDistance && distance <= threshold) {
      bestDistance = distance;
      bestMatch = validKey;
    }
  }

  return bestMatch;
}

/**
 * Main validation function
 */
function validateTranslations() {
  const projectRoot = process.cwd();

  console.info(colors.bold("\n=== Translation Validation Report ===\n"));

  // Load and flatten messages
  const messagesPath = path.join(projectRoot, CONFIG.messagesFile);
  if (!fs.existsSync(messagesPath)) {
    console.error(colors.red(`Error: Messages file not found: ${messagesPath}`));
    process.exit(1);
  }

  const messagesJson = JSON.parse(fs.readFileSync(messagesPath, "utf-8"));
  const validKeys = flattenMessages(messagesJson);

  console.info(
    colors.gray(`Loaded ${validKeys.size} translation keys from en.json\n`)
  );

  // Scan all files
  const allFiles = [];
  for (const dir of CONFIG.scanDirs) {
    const dirPath = path.join(projectRoot, dir);
    const files = getFiles(dirPath, CONFIG.extensions, CONFIG.exclude);
    allFiles.push(...files);
  }

  console.info(colors.gray(`Scanning ${allFiles.length} files...\n`));

  // Extract and validate keys
  const missingByFile = new Map();
  const dynamicByFile = new Map();
  const usedKeys = new Set();
  const dynamicPrefixes = new Set();
  let totalKeysExtracted = 0;
  let totalMissing = 0;
  let totalDynamic = 0;

  for (const file of allFiles) {
    const content = fs.readFileSync(file, "utf-8");

    // Skip files that don't use translations
    if (!content.includes("useTranslations") && !content.includes("getTranslations")) {
      continue;
    }

    const namespace = extractNamespace(content);
    const { static: staticKeys, dynamic: dynamicKeys } = extractTranslationKeys(
      content,
      namespace
    );

    totalKeysExtracted += staticKeys.length;
    totalDynamic += dynamicKeys.length;

    // Check static keys and track used keys
    const missingKeys = [];
    for (const { key, line } of staticKeys) {
      usedKeys.add(key);
      if (!validKeys.has(key)) {
        missingKeys.push({ key, line });
        totalMissing++;
      }
    }

    if (missingKeys.length > 0) {
      const relativePath = path.relative(projectRoot, file);
      missingByFile.set(relativePath, missingKeys);
    }

    // Track dynamic keys and extract their prefixes
    if (dynamicKeys.length > 0) {
      const relativePath = path.relative(projectRoot, file);
      dynamicByFile.set(relativePath, dynamicKeys);

      // Extract prefixes from dynamic keys to mark related keys as potentially used
      for (const { key } of dynamicKeys) {
        const prefixes = extractDynamicPrefixes(key);
        prefixes.forEach((p) => dynamicPrefixes.add(p));
      }
    }
  }

  // Find unused keys (keys in en.json not used in code)
  const unusedKeys = [];
  for (const key of validKeys) {
    // Skip if directly used
    if (usedKeys.has(key)) {
      continue;
    }

    // Skip if matches a dynamic prefix (potentially used dynamically)
    let matchesDynamicPrefix = false;
    for (const prefix of dynamicPrefixes) {
      if (key.startsWith(prefix + ".")) {
        matchesDynamicPrefix = true;
        break;
      }
    }
    if (matchesDynamicPrefix) {
      continue;
    }

    unusedKeys.push(key);
  }

  // Sort unused keys for consistent output
  unusedKeys.sort();

  // Report missing translations
  if (missingByFile.size > 0) {
    console.info(
      colors.red(
        colors.bold(`MISSING TRANSLATIONS (${totalMissing} found):\n`)
      )
    );
    console.info(colors.gray("-".repeat(60)));

    for (const [file, keys] of missingByFile) {
      console.info(colors.cyan(`\n  ${file}`));

      for (const { key, line } of keys) {
        console.info(`    Line ${line}: ${colors.red(key)}`);

        const suggestion = findSuggestion(key, validKeys);
        if (suggestion) {
          console.info(
            colors.green(`      └─ Did you mean: ${suggestion} ?`)
          );
        }
      }
    }
    console.info("");
  }

  // Report dynamic keys
  if (dynamicByFile.size > 0) {
    console.info(
      colors.yellow(
        colors.bold(
          `\nDYNAMIC KEYS (${totalDynamic} - cannot validate statically):\n`
        )
      )
    );
    console.info(colors.gray("-".repeat(60)));

    for (const [file, keys] of dynamicByFile) {
      console.info(colors.cyan(`\n  ${file}`));

      for (const { key, line } of keys) {
        console.info(`    Line ${line}: ${colors.yellow(key)}`);
      }
    }
    console.info("");
  }

  // Report unused keys (warning only)
  if (unusedKeys.length > 0) {
    console.info(
      colors.yellow(
        colors.bold(
          `\nUNUSED TRANSLATIONS (${unusedKeys.length} - warnings only):\n`
        )
      )
    );
    console.info(colors.gray("-".repeat(60)));

    // Group unused keys by top-level namespace for better readability
    const unusedByNamespace = new Map();
    for (const key of unusedKeys) {
      const namespace = key.split(".")[0];
      if (!unusedByNamespace.has(namespace)) {
        unusedByNamespace.set(namespace, []);
      }
      unusedByNamespace.get(namespace).push(key);
    }

    for (const [namespace, keys] of unusedByNamespace) {
      console.info(colors.cyan(`\n  ${namespace}/ (${keys.length} keys)`));

      // Show all keys
      for (const key of keys) {
        console.info(`    ${colors.yellow(key)}`);
      }
    }
    console.info("");
  }

  // Summary
  console.info(colors.gray("-".repeat(60)));
  console.info(colors.bold("\nSUMMARY:"));
  console.info(`  - Files scanned: ${allFiles.length}`);
  console.info(`  - Total keys in en.json: ${validKeys.size}`);
  console.info(`  - Total keys extracted from code: ${totalKeysExtracted}`);
  console.info(
    `  - Missing keys: ${totalMissing > 0 ? colors.red(totalMissing) : colors.green(totalMissing)}`
  );
  console.info(`  - Unused keys: ${unusedKeys.length > 0 ? colors.yellow(unusedKeys.length) : colors.green(unusedKeys.length)} (warning)`);
  console.info(`  - Dynamic keys: ${colors.yellow(totalDynamic)}`);

  // Exit with appropriate code
  if (totalMissing > 0) {
    console.info(colors.red("\nExit code: 1 (missing translations found)\n"));
    process.exit(1);
  } else {
    console.info(colors.green("\nExit code: 0 (all translations valid)\n"));
    process.exit(0);
  }
}

// Run the validation
validateTranslations();
