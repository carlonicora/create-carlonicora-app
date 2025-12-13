import { Command } from 'commander';
import path from 'path';
import chalk from 'chalk';
import { validateProjectName } from './utils/validation.js';
import { directoryExists, directoryIsEmpty } from './utils/files.js';
import { checkGitInstalled, checkPnpmInstalled } from './git.js';
import {
  promptProjectName,
  promptOverwrite,
  promptContinueWithoutGit,
  promptContinueWithoutPnpm,
} from './prompts.js';
import { scaffold } from './scaffold.js';

interface CLIOptions {
  skipGit?: boolean;
  skipInstall?: boolean;
}

const program = new Command();

program
  .name('create-carlonicora-app')
  .description('Create a new NestJS + Next.js monorepo project with Neo4j and JSON:API')
  .version('1.0.0')
  .argument('[project-name]', 'Name of the project')
  .option('--skip-git', 'Skip git initialization and submodules')
  .option('--skip-install', 'Skip dependency installation')
  .action(async (projectName: string | undefined, options: CLIOptions) => {
    console.log();
    console.log(chalk.bold.cyan('create-carlonicora-app'));
    console.log(chalk.gray('Creating a new NestJS + Next.js monorepo project'));
    console.log();

    try {
      // 1. Get project name (from argument or prompt)
      let name = projectName;
      if (!name) {
        name = await promptProjectName();
      } else {
        const validation = validateProjectName(name);
        if (!validation.valid) {
          console.error(chalk.red(`Error: ${validation.message}`));
          process.exit(1);
        }
      }

      // 2. Determine target directory
      const targetDir = path.resolve(process.cwd(), name);

      // 3. Check if directory exists and is not empty
      if (await directoryExists(targetDir)) {
        if (!(await directoryIsEmpty(targetDir))) {
          const overwrite = await promptOverwrite(name);
          if (!overwrite) {
            console.log(chalk.yellow('Aborted.'));
            process.exit(0);
          }
        }
      }

      // 4. Check prerequisites
      let skipGit = options.skipGit ?? false;
      let skipInstall = options.skipInstall ?? false;

      if (!skipGit && !checkGitInstalled()) {
        console.log(chalk.yellow('Warning: Git is not installed.'));
        const continueWithoutGit = await promptContinueWithoutGit();
        if (continueWithoutGit) {
          skipGit = true;
        } else {
          console.log(chalk.yellow('Aborted. Please install git first.'));
          process.exit(0);
        }
      }

      if (!skipInstall && !checkPnpmInstalled()) {
        console.log(chalk.yellow('Warning: pnpm is not installed.'));
        const continueWithoutPnpm = await promptContinueWithoutPnpm();
        if (continueWithoutPnpm) {
          skipInstall = true;
        } else {
          console.log(chalk.yellow('Aborted. Please install pnpm first.'));
          process.exit(0);
        }
      }

      // 5. Run scaffold
      await scaffold({
        projectName: name,
        targetDir,
        skipGit,
        skipInstall,
      });
    } catch (error) {
      console.error();
      if (error instanceof Error) {
        console.error(chalk.red('Error:'), error.message);
      } else {
        console.error(chalk.red('An unexpected error occurred'));
      }
      process.exit(1);
    }
  });

program.parse();
