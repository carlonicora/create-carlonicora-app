import fs from 'fs-extra';
import path from 'path';
import type { ReplacementConfig } from '../types/index.js';
import { applyReplacements } from '../replacer.js';

const BINARY_EXTENSIONS = new Set([
  // Images
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.svg',
  '.bmp',
  '.tiff',
  // Fonts
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
  // Archives
  '.tar',
  '.zip',
  '.gz',
  '.rar',
  '.7z',
  // Documents
  '.pdf',
  // Lock files (treat as binary to avoid corruption)
  '.lock',
  // Other binary formats
  '.exe',
  '.dll',
  '.so',
  '.dylib',
]);

function isBinaryFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

// Files that need to be renamed from "name" to ".name" (npm strips dotfiles)
const DOTFILE_RENAMES: Record<string, string> = {
  gitignore: '.gitignore',
  gitmodules: '.gitmodules',
  prettierrc: '.prettierrc',
  prettierignore: '.prettierignore',
  npmrc: '.npmrc',
  releaserc: '.releaserc',
  swcrc: '.swcrc',
  'env.example': '.env.example',
};

export async function copyTemplate(
  srcDir: string,
  destDir: string,
  config: ReplacementConfig
): Promise<void> {
  const entries = await fs.readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    // Rename dotfiles back to their proper names
    const destName = DOTFILE_RENAMES[entry.name] || entry.name;
    const destPath = path.join(destDir, destName);

    if (entry.isDirectory()) {
      await fs.ensureDir(destPath);
      await copyTemplate(srcPath, destPath, config);
    } else {
      await copyFile(srcPath, destPath, config);
    }
  }
}

async function copyFile(
  srcPath: string,
  destPath: string,
  config: ReplacementConfig
): Promise<void> {
  if (isBinaryFile(srcPath)) {
    // Binary file - copy as-is
    await fs.copy(srcPath, destPath);
  } else {
    // Text file - apply replacements
    try {
      let content = await fs.readFile(srcPath, 'utf-8');
      content = applyReplacements(content, config);
      await fs.writeFile(destPath, content, 'utf-8');
    } catch (error) {
      // If reading as text fails, copy as binary
      await fs.copy(srcPath, destPath);
    }
  }
}

export async function ensureEmptyDir(dir: string): Promise<void> {
  if (await fs.pathExists(dir)) {
    const files = await fs.readdir(dir);
    if (files.length > 0) {
      // Directory exists and is not empty
      await fs.emptyDir(dir);
    }
  } else {
    await fs.ensureDir(dir);
  }
}

export async function directoryExists(dir: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function directoryIsEmpty(dir: string): Promise<boolean> {
  try {
    const files = await fs.readdir(dir);
    return files.length === 0;
  } catch {
    return true;
  }
}
