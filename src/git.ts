import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = promisify(exec);

export async function initGit(targetDir: string): Promise<void> {
  execSync('git init', { cwd: targetDir, stdio: 'pipe' });
  // Force the initial branch to be `master` regardless of the user's
  // `init.defaultBranch` setting. `symbolic-ref` works on the unborn branch
  // (before any commit exists) and is stable across git versions, unlike
  // `git init -b master` which requires git >= 2.28.
  execSync('git symbolic-ref HEAD refs/heads/master', { cwd: targetDir, stdio: 'pipe' });
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
      // Track master so the submodule sits on a branch (not a detached commit)
      // and records `branch = master` in .gitmodules — that makes
      // `git submodule update --remote` (and a plain pull) fetch the latest
      // published library automatically.
      execSync(`git submodule add -b master ${submodule.url} ${submodule.path}`, {
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

  // Check each submodule out ON master at the latest origin/master, so the
  // generated project starts on the newest published library and `git pull`
  // inside a submodule (or `git submodule update --remote`) keeps it current.
  // NOTE: the template's app code (synced from neural-erp) must stay
  // API-compatible with the libraries' master HEAD — e.g. it relies on
  // BlockNoteViewerContainer and the public/howtos controller. If a library
  // ships a breaking change on master, re-sync the template to match.
  for (const submodule of submodules) {
    const sub = path.join(targetDir, submodule.path);
    execSync(`git -C "${sub}" checkout master`, { stdio: 'inherit' });
    execSync(`git -C "${sub}" pull --ff-only origin master`, { stdio: 'inherit' });
  }
}

export async function buildSubmodules(targetDir: string): Promise<void> {
  const submodulePaths = [
    'packages/nestjs-neo4jsonapi',
    'packages/nextjs-jsonapi',
  ];

  for (const submodulePath of submodulePaths) {
    const fullPath = path.join(targetDir, submodulePath);

    // Install submodule's own dependencies first
    execSync('pnpm install --ignore-scripts', {
      cwd: fullPath,
      stdio: 'inherit',
    });

    // Build the submodule to create dist/
    execSync('pnpm build', {
      cwd: fullPath,
      stdio: 'inherit',
    });
  }
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

/**
 * Layer the branch structure on top of the initial commit: master -> test -> dev.
 * All three branches point at the same initial commit; the project is left
 * checked out on `dev`, which is the branch the `claude --worktree` hook
 * branches from. Must run after `createInitialCommit` so master has a commit.
 */
export async function createBranchStructure(targetDir: string): Promise<void> {
  // Create `test` from master, then `dev` from test.
  execSync('git branch test master', { cwd: targetDir, stdio: 'pipe' });
  execSync('git branch dev test', { cwd: targetDir, stdio: 'pipe' });
  // Leave the generated project checked out on dev.
  execSync('git checkout dev', { cwd: targetDir, stdio: 'pipe' });
}
