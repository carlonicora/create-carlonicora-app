/**
 * Patch Applier
 *
 * Applies patches to target applications.
 */

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import type { PatchFile, ApplyOptions, ApplyResult, ConflictInfo } from './types.js';
import { specialize } from './generalizer.js';

/**
 * Generate content hash for comparison
 */
function hashContent(content: string): string {
  return `sha256:${crypto.createHash('sha256').update(content).digest('hex').slice(0, 16)}`;
}

/**
 * Detect project name from target's package.json
 */
async function detectProjectName(targetPath: string): Promise<string> {
  const packageJsonPath = path.join(targetPath, 'package.json');

  if (!(await fs.pathExists(packageJsonPath))) {
    throw new Error(`Cannot detect project name: package.json not found at ${targetPath}`);
  }

  const packageJson = await fs.readJson(packageJsonPath);
  const name = packageJson.name;

  if (!name || typeof name !== 'string') {
    throw new Error('package.json does not contain a valid "name" field');
  }

  return name;
}

/**
 * Check if file has conflicts with existing content
 */
async function checkConflict(
  filePath: string,
  targetPath: string,
  patchedContent: string,
  patchHash: string
): Promise<ConflictInfo | null> {
  const absolutePath = path.join(targetPath, filePath);

  if (!(await fs.pathExists(absolutePath))) {
    return null; // No conflict for new files
  }

  const existingContent = await fs.readFile(absolutePath, 'utf-8');
  const existingHash = hashContent(existingContent);

  // If content is identical, no conflict
  if (existingHash === patchHash) {
    return null;
  }

  // Content differs - this is a conflict
  return {
    path: filePath,
    reason: 'File exists with different content',
    existingHash,
    patchHash,
  };
}

/**
 * Apply a patch to target application
 */
export async function applyPatch(
  patch: PatchFile,
  options: ApplyOptions
): Promise<ApplyResult> {
  const { targetPath, dryRun = false, force = false } = options;

  // Validate target path
  if (!(await fs.pathExists(targetPath))) {
    throw new Error(`Target path does not exist: ${targetPath}`);
  }

  // Detect project name for specialization
  const projectName = await detectProjectName(targetPath);

  const applied: string[] = [];
  const skipped: string[] = [];
  const conflicts: ConflictInfo[] = [];

  for (const file of patch.files) {
    // Specialize content with project name
    const specializedContent = specialize(file.content, projectName);
    const specializedHash = hashContent(specializedContent);

    // Check for conflicts
    const conflict = await checkConflict(
      file.path,
      targetPath,
      specializedContent,
      specializedHash
    );

    if (conflict && !force) {
      conflicts.push(conflict);
      continue;
    }

    if (conflict && force) {
      console.log(`  Force overwriting: ${file.path}`);
    }

    if (!dryRun) {
      const absolutePath = path.join(targetPath, file.path);
      await fs.ensureDir(path.dirname(absolutePath));
      await fs.writeFile(absolutePath, specializedContent, 'utf-8');
    }

    applied.push(file.path);
  }

  const success = conflicts.length === 0 || force;

  return {
    success,
    applied,
    skipped,
    conflicts,
  };
}

/**
 * Preview what a patch would do (dry-run with details)
 */
export async function previewPatch(
  patch: PatchFile,
  targetPath: string
): Promise<{
  wouldApply: string[];
  wouldConflict: ConflictInfo[];
  projectName: string;
}> {
  const projectName = await detectProjectName(targetPath);
  const wouldApply: string[] = [];
  const wouldConflict: ConflictInfo[] = [];

  for (const file of patch.files) {
    const specializedContent = specialize(file.content, projectName);
    const specializedHash = hashContent(specializedContent);

    const conflict = await checkConflict(
      file.path,
      targetPath,
      specializedContent,
      specializedHash
    );

    if (conflict) {
      wouldConflict.push(conflict);
    } else {
      wouldApply.push(file.path);
    }
  }

  return { wouldApply, wouldConflict, projectName };
}
