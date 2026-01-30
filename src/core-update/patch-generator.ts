/**
 * Patch Generator
 *
 * Creates portable patch files from proposed updates.
 */

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import type {
  PatchFile,
  PatchMetadata,
  PatchedFile,
  ReplacementRecord,
  ProposedUpdate,
  UpdateCategory,
} from './types.js';
import { generalize, getDefaultPatterns } from './generalizer.js';

/**
 * Generate content hash for integrity verification
 */
function hashContent(content: string): string {
  return `sha256:${crypto.createHash('sha256').update(content).digest('hex').slice(0, 16)}`;
}

/**
 * Generate patch ID from date and description
 */
function generatePatchId(description: string): string {
  const date = new Date().toISOString().split('T')[0];
  const slug = description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
  return `${date}-${slug}`;
}

/**
 * Get unique categories from proposed updates
 */
function getUniqueCategories(updates: ProposedUpdate[]): UpdateCategory[] {
  const categories = new Set<UpdateCategory>();
  for (const update of updates) {
    categories.add(update.category);
  }
  return Array.from(categories);
}

/**
 * Generate replacement records for the patch
 */
function generateReplacementRecords(appName: string): ReplacementRecord[] {
  const patterns = getDefaultPatterns(appName);
  return patterns
    .filter((p) => typeof p.search === 'string')
    .map((p) => ({
      pattern: p.search as string,
      replacement: p.replace,
    }));
}

/**
 * Determine file operation type
 */
async function determineOperation(
  filePath: string,
  templatePath: string
): Promise<'add' | 'modify'> {
  const templateFilePath = path.join(templatePath, filePath);
  const exists = await fs.pathExists(templateFilePath);
  return exists ? 'modify' : 'add';
}

/**
 * Generate a patch file from proposed updates
 */
export async function generatePatch(
  appPath: string,
  templatePath: string,
  appName: string,
  updates: ProposedUpdate[],
  description: string
): Promise<PatchFile> {
  const patchId = generatePatchId(description);
  const files: PatchedFile[] = [];

  for (const update of updates) {
    const absolutePath = path.join(appPath, update.filePath);

    if (!(await fs.pathExists(absolutePath))) {
      console.warn(`Warning: File not found, skipping: ${update.filePath}`);
      continue;
    }

    const content = await fs.readFile(absolutePath, 'utf-8');
    const generalizedContent = generalize(content, appName);
    const operation = await determineOperation(update.filePath, templatePath);

    const patchedFile: PatchedFile = {
      path: update.filePath,
      operation,
      description: update.description,
      category: update.category,
      content: generalizedContent,
      contentHash: hashContent(generalizedContent),
    };

    files.push(patchedFile);
  }

  const metadata: PatchMetadata = {
    id: patchId,
    createdAt: new Date().toISOString(),
    sourceApp: appName,
    description,
    categories: getUniqueCategories(updates),
    fileCount: files.length,
  };

  const patch: PatchFile = {
    version: '1.0.0',
    metadata,
    files,
    replacements: generateReplacementRecords(appName),
  };

  return patch;
}

/**
 * Save patch to disk
 */
export async function savePatch(patchesDir: string, patch: PatchFile): Promise<string> {
  await fs.ensureDir(patchesDir);
  const filename = `${patch.metadata.id}.patch.json`;
  const filepath = path.join(patchesDir, filename);
  await fs.writeJson(filepath, patch, { spaces: 2 });
  return filepath;
}

/**
 * Load patch from disk
 */
export async function loadPatch(patchPath: string): Promise<PatchFile> {
  if (!(await fs.pathExists(patchPath))) {
    throw new Error(`Patch file not found: ${patchPath}`);
  }
  return fs.readJson(patchPath) as Promise<PatchFile>;
}

/**
 * List all patches in directory
 */
export async function listPatches(patchesDir: string): Promise<PatchFile[]> {
  if (!(await fs.pathExists(patchesDir))) {
    return [];
  }

  const files = await fs.readdir(patchesDir);
  const patches: PatchFile[] = [];

  for (const file of files) {
    if (file.endsWith('.patch.json')) {
      const patch = await loadPatch(path.join(patchesDir, file));
      patches.push(patch);
    }
  }

  // Sort by creation date (newest first)
  patches.sort((a, b) =>
    new Date(b.metadata.createdAt).getTime() - new Date(a.metadata.createdAt).getTime()
  );

  return patches;
}
