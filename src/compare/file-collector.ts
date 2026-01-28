import fs from 'fs-extra';
import path from 'path';
import type { FileEntry } from './types.js';
import {
  IGNORE_PATTERNS,
  ANYWHERE_IGNORE_PATTERNS,
  DOTFILE_RENAMES,
} from './constants.js';

/**
 * Check if a path should be ignored based on patterns
 */
export function shouldIgnore(
  relativePath: string,
  additionalIgnorePatterns: string[] = []
): boolean {
  const normalizedPath = relativePath.replace(/\\/g, '/');
  const pathParts = normalizedPath.split('/');

  // Check patterns that apply anywhere in the path
  for (const pattern of ANYWHERE_IGNORE_PATTERNS) {
    if (pathParts.includes(pattern)) return true;
  }

  // Special case: apps/web/src/features/* is ignored EXCEPT features/common
  if (normalizedPath.startsWith('apps/web/src/features/')) {
    if (!normalizedPath.startsWith('apps/web/src/features/common/') &&
        normalizedPath !== 'apps/web/src/features/common') {
      return true;
    }
  }

  // Check standard ignore patterns
  const allPatterns = [...IGNORE_PATTERNS, ...additionalIgnorePatterns];
  for (const pattern of allPatterns) {
    if (normalizedPath === pattern) return true;
    if (normalizedPath.startsWith(pattern + '/')) return true;
    if (pattern.endsWith('/') && normalizedPath.startsWith(pattern)) return true;
    if (pattern.startsWith('*.')) {
      const ext = pattern.slice(1);
      if (normalizedPath.endsWith(ext)) return true;
    }
    if (pattern === '.tsbuildinfo' && normalizedPath.endsWith('.tsbuildinfo'))
      return true;
  }

  return false;
}

/**
 * Normalize a template path to how it would appear in the target
 * Handles dotfile renames (e.g., 'gitignore' -> '.gitignore')
 */
export function normalizeTemplatePath(templateRelativePath: string): string {
  const parts = templateRelativePath.split('/');
  const fileName = parts[parts.length - 1];

  // Check if the filename needs renaming
  if (DOTFILE_RENAMES[fileName]) {
    parts[parts.length - 1] = DOTFILE_RENAMES[fileName];
    return parts.join('/');
  }

  return templateRelativePath;
}

/**
 * Parse .gitignore file and return patterns
 */
export async function parseGitignore(projectPath: string): Promise<string[]> {
  const gitignorePath = path.join(projectPath, '.gitignore');

  try {
    if (await fs.pathExists(gitignorePath)) {
      const content = await fs.readFile(gitignorePath, 'utf-8');
      return content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    }
  } catch {
    // Ignore errors reading .gitignore
  }

  return [];
}

/**
 * Recursively collect all files from a directory
 */
async function collectFilesRecursive(
  basePath: string,
  currentPath: string,
  files: Map<string, FileEntry>,
  options: {
    normalizeTemplatedDotfiles?: boolean;
    additionalIgnorePatterns?: string[];
  }
): Promise<void> {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(currentPath, entry.name);
    let relativePath = path.relative(basePath, absolutePath);

    // Skip ignored paths
    if (shouldIgnore(relativePath, options.additionalIgnorePatterns)) {
      continue;
    }

    if (entry.isDirectory()) {
      await collectFilesRecursive(basePath, absolutePath, files, options);
    } else if (entry.isFile()) {
      // Normalize path for template files if needed
      if (options.normalizeTemplatedDotfiles) {
        relativePath = normalizeTemplatePath(relativePath);
      }

      files.set(relativePath, {
        relativePath,
        absolutePath,
      });
    }
  }
}

/**
 * Collect all files from a directory
 */
export async function collectFiles(
  basePath: string,
  options: {
    normalizeTemplatedDotfiles?: boolean;
    additionalIgnorePatterns?: string[];
  } = {}
): Promise<Map<string, FileEntry>> {
  const files = new Map<string, FileEntry>();

  if (!(await fs.pathExists(basePath))) {
    throw new Error(`Directory does not exist: ${basePath}`);
  }

  await collectFilesRecursive(basePath, basePath, files, options);

  return files;
}

/**
 * Get the original template path from a normalized path
 * This is the reverse of normalizeTemplatePath
 */
export function getOriginalTemplatePath(normalizedPath: string): string {
  const parts = normalizedPath.split('/');
  const fileName = parts[parts.length - 1];

  // Check if the filename is a renamed dotfile
  for (const [original, renamed] of Object.entries(DOTFILE_RENAMES)) {
    if (fileName === renamed) {
      parts[parts.length - 1] = original;
      return parts.join('/');
    }
  }

  return normalizedPath;
}
