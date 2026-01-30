/**
 * Manifest Manager
 *
 * CRUD operations for .core-update-manifest.json
 */

import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { CoreUpdateManifest, ProposedUpdate, UpdateCategory } from './types.js';

const MANIFEST_FILENAME = '.core-update-manifest.json';
const MANIFEST_VERSION = '1.0.0';

/**
 * Get the manifest file path for a given app directory
 */
export function getManifestPath(appPath: string): string {
  return path.join(appPath, MANIFEST_FILENAME);
}

/**
 * Create a new empty manifest
 */
export function createEmptyManifest(appName: string): CoreUpdateManifest {
  return {
    version: MANIFEST_VERSION,
    appName,
    proposedUpdates: [],
    appliedPatches: [],
    metadata: {
      lastModified: new Date().toISOString(),
    },
  };
}

/**
 * Load manifest from disk, creating new one if it doesn't exist
 */
export async function loadManifest(appPath: string, appName: string): Promise<CoreUpdateManifest> {
  const manifestPath = getManifestPath(appPath);

  if (await fs.pathExists(manifestPath)) {
    const content = await fs.readJson(manifestPath);
    return content as CoreUpdateManifest;
  }

  return createEmptyManifest(appName);
}

/**
 * Save manifest to disk
 */
export async function saveManifest(appPath: string, manifest: CoreUpdateManifest): Promise<void> {
  const manifestPath = getManifestPath(appPath);
  manifest.metadata.lastModified = new Date().toISOString();
  await fs.writeJson(manifestPath, manifest, { spaces: 2 });
}

/**
 * Add a file to proposed updates
 */
export async function addProposedUpdate(
  appPath: string,
  appName: string,
  filePath: string,
  description: string,
  category: UpdateCategory
): Promise<ProposedUpdate> {
  const manifest = await loadManifest(appPath, appName);

  // Check if file already exists in proposals
  const existing = manifest.proposedUpdates.find((u) => u.filePath === filePath);
  if (existing) {
    throw new Error(`File already proposed: ${filePath}`);
  }

  const update: ProposedUpdate = {
    id: uuidv4(),
    filePath,
    description,
    category,
    addedAt: new Date().toISOString(),
  };

  manifest.proposedUpdates.push(update);
  await saveManifest(appPath, manifest);

  return update;
}

/**
 * Remove a file from proposed updates
 */
export async function removeProposedUpdate(
  appPath: string,
  appName: string,
  filePath: string
): Promise<boolean> {
  const manifest = await loadManifest(appPath, appName);

  const index = manifest.proposedUpdates.findIndex((u) => u.filePath === filePath);
  if (index === -1) {
    return false;
  }

  manifest.proposedUpdates.splice(index, 1);
  await saveManifest(appPath, manifest);

  return true;
}

/**
 * Clear all proposed updates
 */
export async function clearProposedUpdates(appPath: string, appName: string): Promise<number> {
  const manifest = await loadManifest(appPath, appName);
  const count = manifest.proposedUpdates.length;

  manifest.proposedUpdates = [];
  await saveManifest(appPath, manifest);

  return count;
}

/**
 * Get all proposed updates
 */
export async function getProposedUpdates(
  appPath: string,
  appName: string
): Promise<ProposedUpdate[]> {
  const manifest = await loadManifest(appPath, appName);
  return manifest.proposedUpdates;
}

/**
 * Record that a patch was applied
 */
export async function recordAppliedPatch(
  appPath: string,
  appName: string,
  patchId: string
): Promise<void> {
  const manifest = await loadManifest(appPath, appName);

  if (!manifest.appliedPatches.includes(patchId)) {
    manifest.appliedPatches.push(patchId);
    await saveManifest(appPath, manifest);
  }
}

/**
 * Check if a patch was already applied
 */
export async function isPatchApplied(
  appPath: string,
  appName: string,
  patchId: string
): Promise<boolean> {
  const manifest = await loadManifest(appPath, appName);
  return manifest.appliedPatches.includes(patchId);
}
