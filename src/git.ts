import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = promisify(exec);

export async function initGit(targetDir: string): Promise<void> {
  execSync('git init', { cwd: targetDir, stdio: 'pipe' });
}

export async function addSubmodules(targetDir: string): Promise<void> {
  const submodules = [
    {
      path: 'packages/nestjs-neo4jsonapi',
      url: 'https://github.com/carlonicora/nestjs-neo4jsonapi',
    },
    {
      path: 'packages/nextjs-jsonapi',
      url: 'https://github.com/carlonicora/nextjs-jsonapi',
    },
  ];

  for (const submodule of submodules) {
    // Remove placeholder directory if it exists (contains .gitkeep)
    const submodulePath = path.join(targetDir, submodule.path);
    if (await fs.pathExists(submodulePath)) {
      await fs.remove(submodulePath);
    }

    try {
      execSync(`git submodule add ${submodule.url} ${submodule.path}`, {
        cwd: targetDir,
        stdio: 'pipe',
      });
    } catch (error) {
      // If submodule already exists, continue
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('already exists')) {
        throw error;
      }
    }
  }

  // Initialize submodules
  execSync('git submodule update --init --recursive', {
    cwd: targetDir,
    stdio: 'pipe',
  });
}

export async function installDependencies(targetDir: string): Promise<void> {
  // Use inherit for stdio so user can see the install progress
  execSync('pnpm install', { cwd: targetDir, stdio: 'inherit' });
}

export function checkGitInstalled(): boolean {
  try {
    execSync('git --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function checkPnpmInstalled(): boolean {
  try {
    execSync('pnpm --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export async function createInitialCommit(targetDir: string): Promise<void> {
  try {
    execSync('git add .', { cwd: targetDir, stdio: 'pipe' });
    execSync('git commit -m "Initial commit from create-carlonicora-app"', {
      cwd: targetDir,
      stdio: 'pipe',
    });
  } catch {
    // Commit might fail if nothing to commit, which is fine
  }
}
