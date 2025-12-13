import chalk from 'chalk';

export const logger = {
  info: (message: string) => console.log(chalk.blue('info'), message),
  success: (message: string) => console.log(chalk.green('success'), message),
  warn: (message: string) => console.log(chalk.yellow('warn'), message),
  error: (message: string) => console.log(chalk.red('error'), message),

  title: (message: string) => console.log(chalk.bold.cyan(`\n${message}\n`)),

  step: (step: number, total: number, message: string) =>
    console.log(chalk.gray(`[${step}/${total}]`), message),

  command: (cmd: string) => console.log(chalk.cyan(`  ${cmd}`)),

  newline: () => console.log(),
};

export function printSuccessMessage(projectName: string, targetDir: string): void {
  console.log();
  console.log(chalk.green.bold('Success!'), `Created ${chalk.cyan(projectName)} at ${chalk.gray(targetDir)}`);
  console.log();
  console.log('Inside that directory, you can run several commands:');
  console.log();
  console.log(chalk.cyan('  pnpm dev'));
  console.log('    Starts the development server');
  console.log();
  console.log(chalk.cyan('  pnpm build'));
  console.log('    Builds the app for production');
  console.log();
  console.log(chalk.cyan('  pnpm test'));
  console.log('    Runs the test suite');
  console.log();
  console.log('We suggest that you begin by typing:');
  console.log();
  console.log(chalk.cyan(`  cd ${projectName}`));
  console.log(chalk.cyan('  cp .env.example .env'));
  console.log(chalk.gray('  # Edit .env with your configuration'));
  console.log(chalk.cyan('  pnpm dev'));
  console.log();
}
