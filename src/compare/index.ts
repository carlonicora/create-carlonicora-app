import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ComparisonReport, FileDiff, ReportSummary } from './types.js';
import {
  collectFiles,
  parseGitignore,
  getOriginalTemplatePath,
} from './file-collector.js';
import { compareFiles } from './file-comparator.js';
import { applyCategories } from './diff-categorizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the template directory path
 */
export function getTemplatePath(): string {
  // Navigate from src/compare to project root, then to template
  return path.resolve(__dirname, '..', '..', 'template');
}

/**
 * Detect project name from target's package.json
 */
export async function detectProjectName(targetPath: string): Promise<string> {
  const packageJsonPath = path.join(targetPath, 'package.json');

  if (!(await fs.pathExists(packageJsonPath))) {
    throw new Error(
      `Cannot detect project name: package.json not found at ${packageJsonPath}`
    );
  }

  try {
    const packageJson = await fs.readJson(packageJsonPath);
    const name = packageJson.name;

    if (!name || typeof name !== 'string') {
      throw new Error('package.json does not contain a valid "name" field');
    }

    return name;
  } catch (error) {
    if (error instanceof Error && error.message.includes('package.json')) {
      throw error;
    }
    throw new Error(`Failed to read package.json: ${error}`);
  }
}

/**
 * Calculate summary statistics from diffs
 */
function calculateSummary(
  diffs: FileDiff[],
  totalTemplateFiles: number,
  totalTargetFiles: number
): ReportSummary {
  const summary: ReportSummary = {
    totalTemplateFiles,
    totalTargetFiles,
    identical: 0,
    configDrift: 0,
    versionDrift: 0,
    missingFromTarget: 0,
    additions: 0,
    customCode: 0,
  };

  for (const diff of diffs) {
    switch (diff.category) {
      case 'identical':
        summary.identical++;
        break;
      case 'config-drift':
        summary.configDrift++;
        break;
      case 'version-drift':
        summary.versionDrift++;
        break;
      case 'missing-from-target':
        summary.missingFromTarget++;
        break;
      case 'addition':
        summary.additions++;
        break;
      case 'custom-code':
        summary.customCode++;
        break;
    }
  }

  return summary;
}

/**
 * Main comparison function
 */
export async function compareTemplate(
  targetPath: string,
  options: {
    projectName?: string;
    verbose?: boolean;
  } = {}
): Promise<ComparisonReport> {
  const templatePath = getTemplatePath();

  // Validate paths
  if (!(await fs.pathExists(targetPath))) {
    throw new Error(`Target path does not exist: ${targetPath}`);
  }

  if (!(await fs.pathExists(templatePath))) {
    throw new Error(`Template path does not exist: ${templatePath}`);
  }

  // Detect project name
  const projectName =
    options.projectName || (await detectProjectName(targetPath));

  // Parse target's .gitignore for additional patterns
  const gitignorePatterns = await parseGitignore(targetPath);

  // Collect files from both sides
  const templateFiles = await collectFiles(templatePath, {
    normalizeTemplatedDotfiles: true,
  });

  const targetFiles = await collectFiles(targetPath, {
    normalizeTemplatedDotfiles: false,
    additionalIgnorePatterns: gitignorePatterns,
  });

  // Create union of all paths
  const allPaths = new Set<string>();
  for (const path of templateFiles.keys()) {
    allPaths.add(path);
  }
  for (const path of targetFiles.keys()) {
    allPaths.add(path);
  }

  // Compare each file
  const diffs: FileDiff[] = [];

  for (const relativePath of allPaths) {
    let templateEntry = templateFiles.get(relativePath);

    // If not found with normalized path, try original template path
    if (!templateEntry) {
      const originalPath = getOriginalTemplatePath(relativePath);
      if (originalPath !== relativePath) {
        templateEntry = templateFiles.get(originalPath);
      }
    }

    const targetEntry = targetFiles.get(relativePath);

    const diff = await compareFiles(templateEntry, targetEntry, projectName);
    diffs.push(diff);
  }

  // Apply categorization
  const categorizedDiffs = applyCategories(diffs);

  // Calculate summary
  const summary = calculateSummary(
    categorizedDiffs,
    templateFiles.size,
    targetFiles.size
  );

  // Build report
  const report: ComparisonReport = {
    generatedAt: new Date().toISOString(),
    templatePath,
    targetPath: path.resolve(targetPath),
    projectName,
    summary,
    diffs: categorizedDiffs,
  };

  return report;
}
