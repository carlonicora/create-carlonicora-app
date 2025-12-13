import path from 'path';
import fs from 'fs-extra';
import ora from 'ora';
import { fileURLToPath } from 'url';
import type { ScaffoldOptions, ReplacementConfig } from './types/index.js';
import { copyTemplate, ensureEmptyDir } from './utils/files.js';
import { toKebabCase, toPascalCase } from './utils/validation.js';
import { initGit, addSubmodules, installDependencies, createInitialCommit } from './git.js';
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
          'Please run "npm run sync-template" first.'
      );
    }

    await copyTemplate(templateDir, targetDir, config);
    spinner.succeed('Copied template files');

    // Step 3: Initialize git repository
    if (!skipGit) {
      spinner.start('Initializing git repository...');
      try {
        await initGit(targetDir);
        spinner.succeed('Initialized git repository');

        // Step 4: Add git submodules
        spinner.start('Adding git submodules (this may take a moment)...');
        await addSubmodules(targetDir);
        spinner.succeed('Added git submodules');

        // Create initial commit
        spinner.start('Creating initial commit...');
        await createInitialCommit(targetDir);
        spinner.succeed('Created initial commit');
      } catch (error) {
        spinner.warn('Git initialization skipped (git may not be installed)');
      }
    } else {
      spinner.info('Skipped git initialization');
    }

    // Step 5: Install dependencies
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

    // Step 6: Print success message
    printSuccessMessage(projectName, targetDir);
  } catch (error) {
    spinner.fail('Scaffold failed');
    throw error;
  }
}
