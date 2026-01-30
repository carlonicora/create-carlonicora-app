/**
 * Patch Command
 *
 * Generate and apply patches.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { getProposedUpdates } from '../core-update/manifest.js';
import { generatePatch, savePatch, listPatches, loadPatch } from '../core-update/patch-generator.js';
import { applyPatch, previewPatch } from '../core-update/patch-applier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getPatchesPath(): string {
  return path.resolve(__dirname, '..', '..', 'patches');
}

function getTemplatePath(): string {
  return path.resolve(__dirname, '..', '..', 'template');
}

async function detectAppName(appPath: string): Promise<string> {
  const packageJsonPath = path.join(appPath, 'package.json');
  if (await fs.pathExists(packageJsonPath)) {
    const pkg = await fs.readJson(packageJsonPath);
    return pkg.name || path.basename(appPath);
  }
  return path.basename(appPath);
}

export function createPatchCommand(): Command {
  const patch = new Command('patch')
    .description('Generate and apply patches');

  // Generate subcommand
  patch
    .command('generate')
    .description('Generate a patch from proposed files')
    .requiredOption('-m, --message <message>', 'Patch description')
    .option('--from <path>', 'Source app path (default: current directory)')
    .action(async (options: { message: string; from?: string }) => {
      try {
        const appPath = options.from ? path.resolve(options.from) : process.cwd();
        const templatePath = getTemplatePath();
        const patchesPath = getPatchesPath();

        const appName = await detectAppName(appPath);
        const updates = await getProposedUpdates(appPath, appName);

        if (updates.length === 0) {
          console.log(chalk.yellow('No files proposed for patch.'));
          console.log(chalk.gray('Use "propose add <file>" to add files first.'));
          return;
        }

        console.log(chalk.bold('Generating patch...'));
        console.log(`  Source: ${chalk.cyan(appPath)}`);
        console.log(`  Files: ${updates.length}`);
        console.log();

        const patchData = await generatePatch(
          appPath,
          templatePath,
          appName,
          updates,
          options.message
        );

        const patchPath = await savePatch(patchesPath, patchData);

        console.log(chalk.green('Patch generated successfully!'));
        console.log(`  ID: ${chalk.cyan(patchData.metadata.id)}`);
        console.log(`  Path: ${patchPath}`);
        console.log(`  Files: ${patchData.files.length}`);
        console.log(`  Categories: ${patchData.metadata.categories.join(', ')}`);
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // List subcommand
  patch
    .command('list')
    .description('List available patches')
    .action(async () => {
      try {
        const patchesPath = getPatchesPath();
        const patches = await listPatches(patchesPath);

        if (patches.length === 0) {
          console.log(chalk.gray('No patches available.'));
          return;
        }

        console.log(chalk.bold('Available patches:'));
        console.log();

        for (const p of patches) {
          console.log(`  ${chalk.cyan(p.metadata.id)}`);
          console.log(`    ${chalk.gray(p.metadata.description)}`);
          console.log(`    Files: ${p.files.length} | From: ${p.metadata.sourceApp} | Date: ${p.metadata.createdAt.split('T')[0]}`);
          console.log();
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // Show subcommand
  patch
    .command('show <patch-id>')
    .description('Show patch details')
    .action(async (patchId: string) => {
      try {
        const patchesPath = getPatchesPath();
        const patchPath = path.join(patchesPath, `${patchId}.patch.json`);

        const patchData = await loadPatch(patchPath);

        console.log(chalk.bold(`Patch: ${patchData.metadata.id}`));
        console.log();
        console.log(`  Description: ${patchData.metadata.description}`);
        console.log(`  Source App: ${patchData.metadata.sourceApp}`);
        console.log(`  Created: ${patchData.metadata.createdAt}`);
        console.log(`  Categories: ${patchData.metadata.categories.join(', ')}`);
        console.log();
        console.log(chalk.bold('Files:'));
        for (const file of patchData.files) {
          console.log(`  ${chalk.cyan(file.path)} [${file.operation}]`);
          console.log(`    ${chalk.gray(file.description)}`);
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  // Apply subcommand
  patch
    .command('apply <patch-id>')
    .description('Apply a patch to current directory or target')
    .option('--target <path>', 'Target app path (default: current directory)')
    .option('--dry-run', 'Show what would be applied without making changes')
    .option('--force', 'Overwrite conflicting files')
    .action(async (patchId: string, options: { target?: string; dryRun?: boolean; force?: boolean }) => {
      try {
        const patchesPath = getPatchesPath();
        const patchPath = path.join(patchesPath, `${patchId}.patch.json`);
        const targetPath = options.target ? path.resolve(options.target) : process.cwd();

        const patchData = await loadPatch(patchPath);

        console.log(chalk.bold(`Applying patch: ${patchData.metadata.id}`));
        console.log(`  Target: ${chalk.cyan(targetPath)}`);
        console.log();

        if (options.dryRun) {
          const preview = await previewPatch(patchData, targetPath);
          console.log(`  Project name: ${chalk.cyan(preview.projectName)}`);
          console.log();

          if (preview.wouldApply.length > 0) {
            console.log(chalk.green('Would apply:'));
            for (const file of preview.wouldApply) {
              console.log(`  ${file}`);
            }
          }

          if (preview.wouldConflict.length > 0) {
            console.log();
            console.log(chalk.yellow('Would conflict:'));
            for (const conflict of preview.wouldConflict) {
              console.log(`  ${conflict.path}`);
              console.log(`    ${chalk.gray(conflict.reason)}`);
            }
          }

          console.log();
          console.log(chalk.gray('Dry run complete. No changes made.'));
          return;
        }

        const result = await applyPatch(patchData, {
          targetPath,
          dryRun: false,
          force: options.force,
        });

        if (result.applied.length > 0) {
          console.log(chalk.green('Applied:'));
          for (const file of result.applied) {
            console.log(`  ${file}`);
          }
        }

        if (result.conflicts.length > 0) {
          console.log();
          console.log(chalk.yellow('Conflicts (skipped):'));
          for (const conflict of result.conflicts) {
            console.log(`  ${conflict.path}`);
            console.log(`    ${chalk.gray(conflict.reason)}`);
          }
          console.log();
          console.log(chalk.gray('Use --force to overwrite conflicting files.'));
        }

        console.log();
        if (result.success) {
          console.log(chalk.green(`Patch applied successfully! (${result.applied.length} file(s))`));
        } else {
          console.log(chalk.yellow(`Patch partially applied. ${result.conflicts.length} conflict(s).`));
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  return patch;
}
