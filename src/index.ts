// Main entry point - re-exports for programmatic usage
export { scaffold } from './scaffold.js';
export { validateProjectName, toKebabCase, toPascalCase } from './utils/validation.js';
export { applyReplacements } from './replacer.js';
export type { ScaffoldOptions, ReplacementConfig, ValidationResult } from './types/index.js';
