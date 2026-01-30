/**
 * Propose Command
 *
 * Stage files for core update.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import {
  addProposedUpdate,
  removeProposedUpdate,
  clearProposedUpdates,
  getProposedUpdates,
  loadManifest,
} from '../core-update/manifest.js';
import type { UpdateCategory } from '../core-update/types.js';

const VALID_CATEGORIES: UpdateCategory[] = ['config', 'ci', 'dx', 'scripts', 'docker', 'docs', 'other'];

async function detectAppName(appPath: string): Promise<string> {
  const packageJsonPath = path.join(appPath, 'package.json');
  if (await fs.pathExists(packageJsonPath)) {
    const pkg = await fs.readJson(packageJsonPath);
    return pkg.name || path.basename(appPath);
  }
  return path.basename(appPath);
}

export function createProposeCommand(): Command {
  const propose = new Command('propose')
    .description('Stage files for core update');

  // Add subcommand
  propose
    .command('add <file>')
    .description('Add a file to the proposal')
    .requiredOption('-d, --description <description>', 'Description of the change')
    .requiredOption('-c, --category <category>', `Category: ${VALID_CATEGORIES.join(', ')}`)
    .action(async (file: string, options: { description: string; category: string }) => {
      try {
        const appPath = process.cwd();
        const appName = await detectAppName(appPath);

        // Validate category
        if (!VALID_CATEGORIES.includes(options.category as UpdateCategory)) {
          console.error(chalk.red(`Invalid category: ${options.category}`));
          console.error(chalk.gray(`Valid categories: ${VALID_CATEGORIES.join(', ')}`));
          process.exit(1);
        }

        // Validate file exists
        const absolutePath = path.join(appPath, file);
        if (!(await fs.pathExists(absolutePath))) {
          console.error(chalk.red(`File not found: ${file}`));
          process.exit(1);
        }

        const update = await addProposedUpdate(
          appPath,
          appName,
          file,
          options.description,
          options.category as UpdateCategory
        );

        console.log(chalk.green('Added to proposals:'));
        console.log(`  File: ${chalk.cyan(file)}`);
        console.log(`  Description: ${options.description}`);
        console.log(`  Category: ${options.category}`);
        console.log(`  ID: ${chalk.gray(update.id)}`);
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // Remove subcommand
  propose
    .command('remove <file>')
    .description('Remove a file from the proposal')
    .action(async (file: string) => {
      try {
        const appPath = process.cwd();
        const appName = await detectAppName(appPath);

        const removed = await removeProposedUpdate(appPath, appName, file);

        if (removed) {
          console.log(chalk.green(`Removed from proposals: ${file}`));
        } else {
          console.log(chalk.yellow(`File not in proposals: ${file}`));
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // List subcommand
  propose
    .command('list')
    .description('List all proposed files')
    .action(async () => {
      try {
        const appPath = process.cwd();
        const appName = await detectAppName(appPath);

        const updates = await getProposedUpdates(appPath, appName);

        if (updates.length === 0) {
          console.log(chalk.gray('No files proposed for update.'));
          return;
        }

        console.log(chalk.bold(`Proposed updates for ${appName}:`));
        console.log();

        for (const update of updates) {
          console.log(`  ${chalk.cyan(update.filePath)}`);
          console.log(`    ${chalk.gray(update.description)}`);
          console.log(`    Category: ${update.category} | Added: ${update.addedAt.split('T')[0]}`);
          console.log();
        }

        console.log(chalk.gray(`Total: ${updates.length} file(s)`));
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // Clear subcommand
  propose
    .command('clear')
    .description('Clear all proposed files')
    .action(async () => {
      try {
        const appPath = process.cwd();
        const appName = await detectAppName(appPath);

        const count = await clearProposedUpdates(appPath, appName);

        if (count > 0) {
          console.log(chalk.green(`Cleared ${count} proposed update(s).`));
        } else {
          console.log(chalk.gray('No proposals to clear.'));
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  return propose;
}
