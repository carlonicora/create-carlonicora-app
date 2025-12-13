import type { ValidationResult } from '../types/index.js';

const RESERVED_NAMES = [
  'node_modules',
  'favicon.ico',
  'package',
  'npm',
  'test',
  'tests',
  'src',
  'dist',
  'build',
  'public',
  'static',
  'assets',
  'app',
  'api',
  'web',
];

// Valid npm package name pattern (kebab-case)
const NPM_NAME_REGEX = /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

export function validateProjectName(name: string): ValidationResult {
  // Must not be empty
  if (!name || name.trim() === '') {
    return { valid: false, message: 'Project name cannot be empty' };
  }

  const trimmedName = name.trim();

  // Must be valid npm package name (kebab-case)
  if (!NPM_NAME_REGEX.test(trimmedName)) {
    return {
      valid: false,
      message: 'Project name must be lowercase, kebab-case (e.g., my-project)',
    };
  }

  // Must not be a reserved name
  if (RESERVED_NAMES.includes(trimmedName.toLowerCase())) {
    return { valid: false, message: `"${trimmedName}" is a reserved name` };
  }

  // Must not start with a dot or underscore
  if (trimmedName.startsWith('.') || trimmedName.startsWith('_')) {
    return { valid: false, message: 'Project name cannot start with a dot or underscore' };
  }

  // Reasonable length limit
  if (trimmedName.length > 100) {
    return { valid: false, message: 'Project name is too long (max 100 characters)' };
  }

  return { valid: true };
}

export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

export function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}
