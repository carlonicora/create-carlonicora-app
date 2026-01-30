/**
 * Sync Command
 *
 * Sync proposed files from app to bootstrapper template.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { getProposedUpdates } from '../core-update/manifest.js';
import { generalize, previewReplacements } from '../core-update/generalizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getTemplatePath(): string {
  // Navigate from src/commands to project root, then to template
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

export function createSyncCommand(): Command {
  const sync = new Command('sync')
    .description('Sync files to bootstrapper template')
    .option('--from <path>', 'Source app path (default: current directory)')
    .option('--proposed-only', 'Only sync proposed files')
    .option('--dry-run', 'Show what would be synced without making changes')
    .action(async (options: { from?: string; proposedOnly?: boolean; dryRun?: boolean }) => {
      try {
        const appPath = options.from ? path.resolve(options.from) : process.cwd();
        const templatePath = getTemplatePath();

        // Validate paths
        if (!(await fs.pathExists(appPath))) {
          console.error(chalk.red(`Source path not found: ${appPath}`));
          process.exit(1);
        }

        if (!(await fs.pathExists(templatePath))) {
          console.error(chalk.red(`Template path not found: ${templatePath}`));
          process.exit(1);
        }

        const appName = await detectAppName(appPath);

        console.log(chalk.bold('Sync to Template'));
        console.log(`  Source: ${chalk.cyan(appPath)}`);
        console.log(`  Template: ${chalk.cyan(templatePath)}`);
        console.log(`  App name: ${chalk.cyan(appName)}`);
        console.log();

        let filesToSync: string[] = [];

        if (options.proposedOnly) {
          const updates = await getProposedUpdates(appPath, appName);
          if (updates.length === 0) {
            console.log(chalk.yellow('No files proposed for update.'));
            console.log(chalk.gray('Use "propose add <file>" to add files.'));
            return;
          }
          filesToSync = updates.map((u) => u.filePath);
          console.log(chalk.gray(`Syncing ${filesToSync.length} proposed file(s)...`));
        } else {
          console.error(chalk.red('--proposed-only is required. Full sync not yet implemented.'));
          console.log(chalk.gray('Use "propose add <file>" to stage files, then run with --proposed-only'));
          process.exit(1);
        }

        let syncedCount = 0;

        for (const filePath of filesToSync) {
          const absoluteSource = path.join(appPath, filePath);
          const absoluteDest = path.join(templatePath, filePath);

          if (!(await fs.pathExists(absoluteSource))) {
            console.log(chalk.yellow(`  Skip (not found): ${filePath}`));
            continue;
          }

          const content = await fs.readFile(absoluteSource, 'utf-8');
          const generalizedContent = generalize(content, appName);

          if (options.dryRun) {
            console.log(chalk.cyan(`  Would sync: ${filePath}`));
            const replacements = previewReplacements(content, appName);
            if (replacements.length > 0) {
              console.log(chalk.gray('    Replacements:'));
              for (const r of replacements) {
                console.log(chalk.gray(`      "${r.original}" -> "${r.replacement}" (${r.count}x)`));
              }
            }
          } else {
            await fs.ensureDir(path.dirname(absoluteDest));
            await fs.writeFile(absoluteDest, generalizedContent, 'utf-8');
            console.log(chalk.green(`  Synced: ${filePath}`));
          }

          syncedCount++;
        }

        console.log();
        if (options.dryRun) {
          console.log(chalk.gray(`Dry run complete. Would sync ${syncedCount} file(s).`));
        } else {
          console.log(chalk.green(`Synced ${syncedCount} file(s) to template.`));
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

  return sync;
}
