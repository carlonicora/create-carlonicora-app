import type { ComparisonReport, FileDiff, DiffCategory } from './types.js';

/**
 * Group diffs by category
 */
function groupByCategory(
  diffs: FileDiff[]
): Map<DiffCategory, FileDiff[]> {
  const groups = new Map<DiffCategory, FileDiff[]>();

  for (const diff of diffs) {
    const existing = groups.get(diff.category) || [];
    existing.push(diff);
    groups.set(diff.category, existing);
  }

  return groups;
}


/**
 * Format a diff summary for display
 */
function formatDiffBlock(diff: FileDiff): string {
  if (!diff.diffSummary) {
    return '';
  }

  const lines = diff.diffSummary.split('\n');
  if (lines.length === 0) return '';

  return `\`\`\`diff\n${lines.slice(0, 20).join('\n')}${lines.length > 20 ? '\n... (truncated)' : ''}\n\`\`\``;
}

/**
 * Generate the markdown report
 */
export function generateMarkdownReport(report: ComparisonReport): string {
  const lines: string[] = [];
  const grouped = groupByCategory(report.diffs);

  // Header
  lines.push('# Template Comparison Report');
  lines.push('');
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push(`**Template:** ${report.templatePath}`);
  lines.push(`**Target:** ${report.targetPath}`);
  lines.push(`**Project Name:** ${report.projectName}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push('| Category | Count |');
  lines.push('|----------|-------|');
  lines.push(`| Config Drift | ${report.summary.configDrift} |`);
  lines.push(`| Version Drift | ${report.summary.versionDrift} |`);
  lines.push(`| Additions | ${report.summary.additions} |`);
  lines.push(`| Custom Code | ${report.summary.customCode} |`);
  lines.push('');
  lines.push(
    `**Total:** ${report.summary.totalTemplateFiles} template files, ${report.summary.totalTargetFiles} target files compared`
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  // Version Drift Section
  const versionDrifts = grouped.get('version-drift') || [];
  if (versionDrifts.length > 0) {
    lines.push('## Version Drift');
    lines.push('');
    lines.push('Files where only dependency versions differ from template.');
    lines.push('');

    for (const diff of versionDrifts) {
      lines.push(`### \`${diff.relativePath}\``);
      lines.push('');

      if (diff.diffSummary) {
        lines.push(formatDiffBlock(diff));
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
  }

  // Config Drift Section
  const configDrifts = grouped.get('config-drift') || [];
  if (configDrifts.length > 0) {
    lines.push('## Config Drift');
    lines.push('');
    lines.push('Configuration files that have been modified beyond version changes.');
    lines.push('');

    for (const diff of configDrifts) {
      lines.push(`### \`${diff.relativePath}\``);
      lines.push('');

      if (diff.diffSummary) {
        lines.push(formatDiffBlock(diff));
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
  }


  // Additions Section
  const additions = grouped.get('addition') || [];
  if (additions.length > 0) {
    lines.push('## Additions');
    lines.push('');
    lines.push("Files in target that don't exist in template (project-specific code).");
    lines.push('');

    for (const diff of additions.sort((a, b) =>
      a.relativePath.localeCompare(b.relativePath)
    )) {
      lines.push(`- \`${diff.relativePath}\``);
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Custom Code Section
  const customCode = grouped.get('custom-code') || [];
  if (customCode.length > 0) {
    lines.push('## Custom Code Changes');
    lines.push('');
    lines.push('Application code that differs from template baseline.');
    lines.push('');

    for (const diff of customCode) {
      lines.push(`### \`${diff.relativePath}\``);
      lines.push('');

      if (diff.diffSummary) {
        lines.push(formatDiffBlock(diff));
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate JSON report
 */
export function generateJsonReport(report: ComparisonReport): string {
  return JSON.stringify(report, null, 2);
}
