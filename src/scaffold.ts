import path from 'path';
import fs from 'fs-extra';
import ora from 'ora';
import { fileURLToPath } from 'url';
import type { ScaffoldOptions, ReplacementConfig } from './types/index.js';
import { copyTemplate, ensureEmptyDir } from './utils/files.js';
import { toKebabCase, toPascalCase } from './utils/validation.js';
import {
  initGit,
  addSubmodules,
  buildSubmodules,
  installDependencies,
  createInitialCommit,
  createBranchStructure,
} from './git.js';
import { printSuccessMessage } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function scaffold(options: ScaffoldOptions): Promise<void> {
  const { projectName, targetDir, skipGit, skipInstall } = options;

  const config: ReplacementConfig = {
    projectName,
    projectNameKebab: toKebabCase(projectName),
    projectNamePascal: toPascalCase(projectName),
  };

  const spinner = ora();

  try {
    // Step 1: Create/clean target directory
    spinner.start('Creating project directory...');
    await ensureEmptyDir(targetDir);
    spinner.succeed('Created project directory');

    // Step 2: Copy template files with replacements
    spinner.start('Copying template files...');
    const templateDir = path.join(__dirname, '..', 'template');

    if (!(await fs.pathExists(templateDir))) {
      spinner.fail('Template directory not found');
      throw new Error(
        `Template directory not found at ${templateDir}. ` +
          'The template/ directory ships with this package; a missing one means a broken install.'
      );
    }

    await copyTemplate(templateDir, targetDir, config);
    spinner.succeed('Copied template files');

    // Step 3: Initialize git repository (on master) + submodules. The initial
    // commit is intentionally deferred until after `pnpm install` (Step 4) so
    // the resolved pnpm-lock.yaml is captured in every branch.
    let gitInitialized = false;
    if (!skipGit) {
      spinner.start('Initializing git repository...');
      try {
        await initGit(targetDir);
        spinner.succeed('Initialized git repository (master)');

        // Step 3a: Add git submodules
        spinner.start('Adding git submodules (this may take a moment)...');
        await addSubmodules(targetDir);
        spinner.succeed('Added git submodules');

        // Step 3b: Build submodules to create dist/ directories
        spinner.start('Building submodule packages (this may take a moment)...');
        spinner.stopAndPersist({ symbol: '🔨', text: 'Building submodule packages...' });
        await buildSubmodules(targetDir);
        spinner.succeed('Built submodule packages');

        gitInitialized = true;
      } catch (error) {
        spinner.warn('Git initialization skipped (git may not be installed)');
      }
    } else {
      spinner.info('Skipped git initialization');
    }

    // Step 4: Install dependencies (before the initial commit so the resolved
    // pnpm-lock.yaml lands in the commit shared by all branches)
    if (!skipInstall) {
      spinner.start('Installing dependencies (this may take a few minutes)...');
      spinner.stopAndPersist({ symbol: '📦', text: 'Installing dependencies...' });
      try {
        await installDependencies(targetDir);
        spinner.succeed('Installed dependencies');
      } catch (error) {
        spinner.warn('Dependency installation failed. Run "pnpm install" manually.');
      }
    } else {
      spinner.info('Skipped dependency installation');
    }

    // Step 5: Commit once on master, then layer test + dev on top, leaving the
    // project checked out on dev. Runs only if git init succeeded above.
    if (gitInitialized) {
      spinner.start('Creating initial commit...');
      await createInitialCommit(targetDir);
      spinner.succeed('Created initial commit');

      spinner.start('Creating branches (master → test → dev)...');
      await createBranchStructure(targetDir);
      spinner.succeed('Created branches — checked out dev');
    }

    // Step 6: Print success message
    printSuccessMessage(projectName, targetDir);
  } catch (error) {
    spinner.fail('Scaffold failed');
    throw error;
  }
}
