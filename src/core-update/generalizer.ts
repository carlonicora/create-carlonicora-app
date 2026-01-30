/**
 * Generalizer
 *
 * Converts app-specific content to template placeholders and vice versa.
 */

import type { ReplacementPattern } from './types.js';

/**
 * Default replacement patterns (priority order: highest first)
 * These patterns convert app-specific references to {{name}} placeholders.
 */
export function getDefaultPatterns(appName: string): ReplacementPattern[] {
  return [
    // Package names (most specific)
    { search: `${appName}-api`, replace: '{{name}}-api', priority: 100 },
    { search: `${appName}-web`, replace: '{{name}}-web', priority: 100 },
    { search: `@${appName}/shared`, replace: '@{{name}}/shared', priority: 100 },

    // URLs/Hostnames
    { search: `api.${appName}.test`, replace: 'api.{{name}}.test', priority: 90 },
    { search: `minio.${appName}.test`, replace: 'minio.{{name}}.test', priority: 90 },
    { search: `${appName}.test`, replace: '{{name}}.test', priority: 80 },

    // Email addresses
    { search: `admin@${appName}.com`, replace: 'admin@{{name}}.com', priority: 85 },
    { search: `info@${appName}.com`, replace: 'info@{{name}}.com', priority: 85 },
    { search: `${appName}<info@${appName}.com>`, replace: '{{name}}<info@{{name}}.com>', priority: 85 },

    // Secrets and service names
    { search: `${appName}_SECRET`, replace: '{{name}}_SECRET', priority: 85 },

    // Database and Redis
    { search: `NEO4J_DATABASE=${appName}`, replace: 'NEO4J_DATABASE={{name}}', priority: 85 },
    { search: `REDIS_QUEUE=${appName}`, replace: 'REDIS_QUEUE={{name}}', priority: 85 },
    { search: `S3_BUCKET="${appName}"`, replace: 'S3_BUCKET="{{name}}"', priority: 85 },

    // Turbo task names
    { search: `${appName}-web#build`, replace: '{{name}}-web#build', priority: 80 },

    // Config values with quotes
    { search: `"${appName}"`, replace: '"{{name}}"', priority: 70 },
    { search: `'${appName}'`, replace: "'{{name}}'", priority: 70 },

    // Logo references
    { search: `/${appName}-logo`, replace: '/{{name}}-logo', priority: 75 },
    { search: `${appName}-logo`, replace: '{{name}}-logo', priority: 75 },
  ];
}

/**
 * Create a regex pattern for word-boundary matching (lowest priority fallback)
 */
export function createWordBoundaryPattern(appName: string): ReplacementPattern {
  return {
    search: new RegExp(`\\b${escapeRegExp(appName)}\\b`, 'gi'),
    replace: '{{name}}',
    priority: 10,
  };
}

/**
 * Escape special regex characters
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sort patterns by priority (highest first)
 */
function sortByPriority(patterns: ReplacementPattern[]): ReplacementPattern[] {
  return [...patterns].sort((a, b) => b.priority - a.priority);
}

/**
 * Generalize content: replace app-specific values with placeholders
 */
export function generalize(
  content: string,
  appName: string,
  additionalPatterns: ReplacementPattern[] = []
): string {
  const allPatterns = [
    ...getDefaultPatterns(appName),
    ...additionalPatterns,
    createWordBoundaryPattern(appName),
  ];

  const sortedPatterns = sortByPriority(allPatterns);
  let result = content;

  for (const { search, replace } of sortedPatterns) {
    if (search instanceof RegExp) {
      result = result.replace(search, replace);
    } else {
      result = result.split(search).join(replace);
    }
  }

  return result;
}

/**
 * Specialize content: replace placeholders with project-specific values
 */
export function specialize(content: string, projectName: string): string {
  return content.split('{{name}}').join(projectName);
}

/**
 * Check if content contains app-specific references
 */
export function hasAppReferences(content: string, appName: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegExp(appName)}\\b`, 'i');
  return pattern.test(content);
}

/**
 * Get list of replacements that would be made (for dry-run/preview)
 */
export function previewReplacements(
  content: string,
  appName: string
): Array<{ original: string; replacement: string; count: number }> {
  const allPatterns = [
    ...getDefaultPatterns(appName),
    createWordBoundaryPattern(appName),
  ];

  const sortedPatterns = sortByPriority(allPatterns);
  const replacements: Array<{ original: string; replacement: string; count: number }> = [];

  for (const { search, replace } of sortedPatterns) {
    if (search instanceof RegExp) {
      const matches = content.match(search);
      if (matches && matches.length > 0) {
        replacements.push({
          original: search.source,
          replacement: replace,
          count: matches.length,
        });
      }
    } else {
      const count = content.split(search).length - 1;
      if (count > 0) {
        replacements.push({
          original: search,
          replacement: replace,
          count,
        });
      }
    }
  }

  return replacements;
}
