import type { ReplacementConfig } from './types/index.js';

/**
 * Replaces template placeholders with the actual project values.
 *
 * Placeholders:
 *   {{name}}    → kebab-case project name (e.g. "my-app")
 *   {{display}} → human-readable project name as entered (e.g. "My App")
 *
 * The template files use these placeholders which get replaced with the
 * user's chosen project name during scaffolding.
 */
export function applyReplacements(content: string, config: ReplacementConfig): string {
  return content
    .split('{{display}}').join(config.projectName)
    .split('{{name}}').join(config.projectNameKebab);
}
