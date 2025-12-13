import type { ReplacementConfig } from './types/index.js';

/**
 * Replaces {{name}} placeholders with the actual project name.
 *
 * The template files use {{name}} as a placeholder which gets replaced
 * with the user's chosen project name during scaffolding.
 */
export function applyReplacements(content: string, config: ReplacementConfig): string {
  // Simple replacement of {{name}} placeholder with project name
  return content.split('{{name}}').join(config.projectNameKebab);
}
