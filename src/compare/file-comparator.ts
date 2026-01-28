import fs from 'fs-extra';
import path from 'path';
import type { FileEntry, FileDiff, VersionDiff } from './types.js';
import { BINARY_EXTENSIONS, MAX_DIFF_FILE_SIZE } from './constants.js';

/**
 * Check if a file is binary based on extension
 */
export function isBinaryFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * Replace {{name}} placeholders with the project name
 */
export function resolvePlaceholders(
  content: string,
  projectName: string
): string {
  return content.split('{{name}}').join(projectName);
}

/**
 * Normalize line endings to LF
 */
function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Normalize content for comparison - strips trailing whitespace from each line
 * and ensures consistent trailing newline
 */
function normalizeForComparison(content: string): string {
  return content
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

/**
 * Generate a simple unified diff summary
 */
function generateDiffSummary(
  templateContent: string,
  targetContent: string
): string {
  const templateLines = templateContent.split('\n');
  const targetLines = targetContent.split('\n');

  const added: string[] = [];
  const removed: string[] = [];

  // Simple diff: find lines that differ
  const templateSet = new Set(templateLines);
  const targetSet = new Set(targetLines);

  for (const line of templateLines) {
    if (!targetSet.has(line) && line.trim()) {
      removed.push(line);
    }
  }

  for (const line of targetLines) {
    if (!templateSet.has(line) && line.trim()) {
      added.push(line);
    }
  }

  const diffLines: string[] = [];

  // Show a summary of changes
  if (removed.length > 0) {
    const maxRemoved = Math.min(removed.length, 10);
    for (let i = 0; i < maxRemoved; i++) {
      diffLines.push(`- ${removed[i]}`);
    }
    if (removed.length > maxRemoved) {
      diffLines.push(`... and ${removed.length - maxRemoved} more removed lines`);
    }
  }

  if (added.length > 0) {
    const maxAdded = Math.min(added.length, 10);
    for (let i = 0; i < maxAdded; i++) {
      diffLines.push(`+ ${added[i]}`);
    }
    if (added.length > maxAdded) {
      diffLines.push(`... and ${added.length - maxAdded} more added lines`);
    }
  }

  return diffLines.join('\n');
}

/**
 * Detect version drift in package.json files
 */
export function detectVersionDrift(
  templateContent: string,
  targetContent: string
): { isVersionDriftOnly: boolean; versionDiffs: VersionDiff[] } {
  try {
    const templatePkg = JSON.parse(templateContent);
    const targetPkg = JSON.parse(targetContent);

    const versionDiffs: VersionDiff[] = [];
    let hasStructuralChanges = false;

    // Compare top-level keys (excluding version-related)
    const versionKeys = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
      'version',
    ];

    // Check for structural changes in non-version keys
    const allKeys = new Set([
      ...Object.keys(templatePkg),
      ...Object.keys(targetPkg),
    ]);

    for (const key of allKeys) {
      if (versionKeys.includes(key)) continue;

      const templateVal = JSON.stringify(templatePkg[key]);
      const targetVal = JSON.stringify(targetPkg[key]);

      if (templateVal !== targetVal) {
        hasStructuralChanges = true;
        break;
      }
    }

    // Collect version differences
    for (const depKey of [
      'dependencies',
      'devDependencies',
      'peerDependencies',
    ]) {
      const templateDeps = templatePkg[depKey] || {};
      const targetDeps = targetPkg[depKey] || {};

      const allPackages = new Set([
        ...Object.keys(templateDeps),
        ...Object.keys(targetDeps),
      ]);

      for (const pkg of allPackages) {
        const templateVersion = templateDeps[pkg];
        const targetVersion = targetDeps[pkg];

        if (templateVersion !== targetVersion) {
          if (!templateVersion || !targetVersion) {
            // Package added or removed - structural change
            hasStructuralChanges = true;
          } else {
            versionDiffs.push({
              package: pkg,
              templateVersion,
              targetVersion,
            });
          }
        }
      }
    }

    return {
      isVersionDriftOnly: !hasStructuralChanges && versionDiffs.length > 0,
      versionDiffs,
    };
  } catch {
    // JSON parsing failed
    return { isVersionDriftOnly: false, versionDiffs: [] };
  }
}

/**
 * Compare two files and generate a FileDiff
 */
export async function compareFiles(
  templateEntry: FileEntry | undefined,
  targetEntry: FileEntry | undefined,
  projectName: string
): Promise<FileDiff> {
  const relativePath =
    templateEntry?.relativePath || targetEntry?.relativePath || '';

  // File only in target (addition)
  if (!templateEntry && targetEntry) {
    return {
      relativePath,
      category: 'addition',
    };
  }

  // File only in template (missing from target)
  if (templateEntry && !targetEntry) {
    return {
      relativePath,
      category: 'missing-from-target',
    };
  }

  // Both files exist - compare content
  if (templateEntry && targetEntry) {
    // Skip binary files content comparison
    if (isBinaryFile(templateEntry.absolutePath)) {
      return {
        relativePath,
        category: 'identical',
      };
    }

    try {
      const templateRaw = await fs.readFile(
        templateEntry.absolutePath,
        'utf-8'
      );
      const targetContent = normalizeLineEndings(
        await fs.readFile(targetEntry.absolutePath, 'utf-8')
      );

      // Resolve placeholders and normalize
      const templateContent = normalizeLineEndings(
        resolvePlaceholders(templateRaw, projectName)
      );

      // Check if identical (after normalizing whitespace)
      const normalizedTemplate = normalizeForComparison(templateContent);
      const normalizedTarget = normalizeForComparison(targetContent);

      if (normalizedTemplate === normalizedTarget) {
        return {
          relativePath,
          category: 'identical',
        };
      }

      // Files are different - check for version drift in package.json
      if (relativePath.endsWith('package.json')) {
        const { isVersionDriftOnly, versionDiffs } = detectVersionDrift(
          templateContent,
          targetContent
        );

        if (isVersionDriftOnly) {
          return {
            relativePath,
            category: 'version-drift',
            templateContent,
            targetContent,
            versionDiffs,
          };
        }
      }

      // Generate diff summary for non-large files
      let diffSummary: string | undefined;
      const fileSize = Math.max(templateContent.length, targetContent.length);

      if (fileSize <= MAX_DIFF_FILE_SIZE) {
        diffSummary = generateDiffSummary(templateContent, targetContent);
      } else {
        diffSummary = `File too large for diff (${Math.round(fileSize / 1024)}KB)`;
      }

      // Categorization will be done by diff-categorizer
      return {
        relativePath,
        category: 'config-drift', // Default, will be refined
        templateContent,
        targetContent,
        diffSummary,
      };
    } catch (error) {
      // Error reading files - treat as different
      return {
        relativePath,
        category: 'config-drift',
        diffSummary: `Error comparing files: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Should never reach here
  return {
    relativePath,
    category: 'identical',
  };
}
