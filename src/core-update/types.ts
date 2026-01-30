/**
 * Core Update Types
 *
 * Type definitions for the core update workflow system.
 */

export type UpdateCategory = "config" | "ci" | "dx" | "scripts" | "docker" | "docs" | "other";

export interface ProposedUpdate {
  id: string;
  filePath: string;
  description: string;
  category: UpdateCategory;
  addedAt: string;
}

export interface CoreUpdateManifest {
  version: "1.0.0";
  appName: string;
  proposedUpdates: ProposedUpdate[];
  appliedPatches: string[];
  metadata: {
    lastModified: string;
  };
}

export interface ReplacementPattern {
  search: string | RegExp;
  replace: string;
  priority: number;
}

export interface PatchMetadata {
  id: string;
  createdAt: string;
  sourceApp: string;
  description: string;
  categories: UpdateCategory[];
  fileCount: number;
}

export interface PatchedFile {
  path: string;
  operation: "add" | "modify" | "delete";
  description: string;
  category: UpdateCategory;
  content: string;
  contentHash: string;
}

export interface ReplacementRecord {
  pattern: string;
  replacement: string;
}

export interface PatchFile {
  version: "1.0.0";
  metadata: PatchMetadata;
  files: PatchedFile[];
  replacements: ReplacementRecord[];
}

export interface ApplyOptions {
  targetPath: string;
  dryRun?: boolean;
  force?: boolean;
}

export interface ConflictInfo {
  path: string;
  reason: string;
  existingHash?: string;
  patchHash?: string;
}

export interface ApplyResult {
  success: boolean;
  applied: string[];
  skipped: string[];
  conflicts: ConflictInfo[];
}
