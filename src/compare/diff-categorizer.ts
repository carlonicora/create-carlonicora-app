import type { FileDiff, DiffCategory } from './types.js';
import { CONFIG_FILE_PATTERNS, CODE_PATHS } from './constants.js';

/**
 * Check if a file path matches any of the config file patterns
 */
function isConfigFile(relativePath: string): boolean {
  const fileName = relativePath.split('/').pop() || '';

  for (const pattern of CONFIG_FILE_PATTERNS) {
    if (fileName === pattern) return true;
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      if (regex.test(fileName)) return true;
    }
  }

  return false;
}

/**
 * Check if a file path is within a code path
 */
function isCodePath(relativePath: string): boolean {
  const normalizedPath = relativePath.replace(/\\/g, '/');

  for (const codePath of CODE_PATHS) {
    if (normalizedPath.startsWith(codePath)) {
      return true;
    }
  }

  return false;
}

/**
 * Categorize a file diff based on its path and content changes
 */
export function categorizeDiff(diff: FileDiff): DiffCategory {
  const { relativePath, category } = diff;

  // Keep certain categories as-is
  if (
    category === 'identical' ||
    category === 'addition' ||
    category === 'missing-from-target' ||
    category === 'version-drift'
  ) {
    return category;
  }

  // For modified files, categorize based on path
  if (isCodePath(relativePath)) {
    return 'custom-code';
  }

  if (isConfigFile(relativePath)) {
    return 'config-drift';
  }

  // Default to config-drift for other files
  return 'config-drift';
}

/**
 * Categorize an addition (file in target but not in template)
 */
export function categorizeAddition(relativePath: string): {
  category: string;
  group: string;
} {
  const normalizedPath = relativePath.replace(/\\/g, '/');

  // Feature modules
  if (normalizedPath.startsWith('apps/api/src/features/')) {
    const featureName = normalizedPath.split('/')[4] || 'unknown';
    return { category: 'Feature Module (API)', group: featureName };
  }

  if (normalizedPath.startsWith('apps/web/src/features/')) {
    const featureName = normalizedPath.split('/')[4] || 'unknown';
    return { category: 'Feature Module (Web)', group: featureName };
  }

  // Documentation
  if (
    normalizedPath.startsWith('docs/') ||
    normalizedPath.endsWith('.md') ||
    normalizedPath === 'AGENTS.md' ||
    normalizedPath === 'CONTRIBUTING.md' ||
    normalizedPath === 'AI-ARCHITECTURE-GUIDE.md'
  ) {
    return { category: 'Documentation', group: 'docs' };
  }

  // Configuration/Infrastructure
  if (
    normalizedPath.startsWith('infrastructure/') ||
    normalizedPath.startsWith('openspec/')
  ) {
    return { category: 'Infrastructure', group: normalizedPath.split('/')[0] };
  }

  // Structure/Schema definitions
  if (normalizedPath.startsWith('structure/')) {
    return { category: 'Data Structures', group: 'structure' };
  }

  // Tests
  if (
    normalizedPath.includes('__tests__/') ||
    normalizedPath.includes('.test.') ||
    normalizedPath.includes('.spec.')
  ) {
    return { category: 'Tests', group: 'tests' };
  }

  // Scripts
  if (normalizedPath.startsWith('scripts/')) {
    return { category: 'Scripts', group: 'scripts' };
  }

  // API source additions
  if (normalizedPath.startsWith('apps/api/src/')) {
    return { category: 'API Source', group: 'apps/api' };
  }

  // Web source additions
  if (normalizedPath.startsWith('apps/web/src/')) {
    return { category: 'Web Source', group: 'apps/web' };
  }

  // Shared package additions
  if (normalizedPath.startsWith('packages/shared/')) {
    return { category: 'Shared Package', group: 'packages/shared' };
  }

  // Library packages (full implementations)
  if (normalizedPath.startsWith('packages/nestjs-neo4jsonapi/')) {
    return { category: 'Library Package', group: 'nestjs-neo4jsonapi' };
  }

  if (normalizedPath.startsWith('packages/nextjs-jsonapi/')) {
    return { category: 'Library Package', group: 'nextjs-jsonapi' };
  }

  // Root files
  if (!normalizedPath.includes('/')) {
    return { category: 'Root Files', group: 'root' };
  }

  // Default
  return { category: 'Other', group: 'other' };
}

/**
 * Apply categorization to all diffs
 */
export function applyCategories(diffs: FileDiff[]): FileDiff[] {
  return diffs.map((diff) => ({
    ...diff,
    category: categorizeDiff(diff),
  }));
}
