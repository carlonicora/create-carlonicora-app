import { input, confirm } from '@inquirer/prompts';
import { validateProjectName } from './utils/validation.js';

export async function promptProjectName(): Promise<string> {
  return input({
    message: 'What is your project name?',
    validate: (value: string) => {
      const result = validateProjectName(value);
      return result.valid || result.message!;
    },
  });
}

export async function promptOverwrite(dirName: string): Promise<boolean> {
  return confirm({
    message: `Directory "${dirName}" already exists and is not empty. Overwrite?`,
    default: false,
  });
}

export async function promptContinueWithoutGit(): Promise<boolean> {
  return confirm({
    message: 'Git is not installed. Continue without git initialization?',
    default: true,
  });
}

export async function promptContinueWithoutPnpm(): Promise<boolean> {
  return confirm({
    message: 'pnpm is not installed. Continue without dependency installation?',
    default: true,
  });
}
