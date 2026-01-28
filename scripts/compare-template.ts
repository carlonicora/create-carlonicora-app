#!/usr/bin/env node

/**
 * Template Comparison Script
 *
 * Compares the template files from this bootstrapper against an implemented project
 * and generates a categorized markdown report showing differences.
 *
 * Usage: pnpm compare-template /path/to/target-project [options]
 *
 * Options:
 *   --output <path>   Write report to file instead of stdout
 *   --json            Output as JSON instead of markdown
 *   --verbose         Include more detailed diffs
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { compareTemplate } from '../src/compare/index.js';
import {
  generateMarkdownReport,
  generateJsonReport,
} from '../src/compare/report-generator.js';

interface CLIOptions {
  output?: string;
  json?: boolean;
  verbose?: boolean;
}

const program = new Command();

program
  .name('compare-template')
  .description(
    'Compare template files against an implemented project and generate a diff report'
  )
  .version('1.0.0')
  .argument('<target-path>', 'Path to the implemented project to compare against')
  .option('-o, --output <path>', 'Write report to file instead of stdout')
  .option('--json', 'Output as JSON instead of markdown')
  .option('-v, --verbose', 'Include more detailed diffs')
  .action(async (targetPath: string, options: CLIOptions) => {
    console.log();
    console.log(chalk.bold.cyan('Template Comparison'));
    console.log(chalk.gray('Comparing template against implemented project'));
    console.log();

    try {
      // Resolve target path
      const resolvedTarget = path.resolve(process.cwd(), targetPath);

      // Check if target exists
      if (!(await fs.pathExists(resolvedTarget))) {
        console.error(chalk.red(`Error: Target path does not exist: ${resolvedTarget}`));
        process.exit(1);
      }

      // Check if target is a directory
      const stat = await fs.stat(resolvedTarget);
      if (!stat.isDirectory()) {
        console.error(chalk.red('Error: Target path must be a directory'));
        process.exit(1);
      }

      console.log(chalk.gray(`Target: ${resolvedTarget}`));
      console.log();

      // Run comparison
      console.log(chalk.yellow('Comparing files...'));
      const report = await compareTemplate(resolvedTarget, {
        verbose: options.verbose,
      });

      console.log(chalk.green(`Detected project name: ${report.projectName}`));
      console.log();

      // Generate report
      const output = options.json
        ? generateJsonReport(report)
        : generateMarkdownReport(report);

      // Output report
      if (options.output) {
        const outputPath = path.resolve(process.cwd(), options.output);
        await fs.writeFile(outputPath, output, 'utf-8');
        console.log(chalk.green(`Report written to: ${outputPath}`));
      } else {
        console.log();
        console.log(output);
      }

      // Print summary to stderr if outputting to file
      if (options.output) {
        console.log();
        console.log(chalk.bold('Summary:'));
        console.log(`  Config Drift:        ${chalk.yellow(report.summary.configDrift)}`);
        console.log(`  Version Drift:       ${chalk.blue(report.summary.versionDrift)}`);
        console.log(`  Additions:           ${chalk.cyan(report.summary.additions)}`);
        console.log(`  Custom Code:         ${chalk.magenta(report.summary.customCode)}`);
      }
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
