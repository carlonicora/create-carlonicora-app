export interface CompareConfig {
  templatePath: string;
  targetPath: string;
  projectName: string;
}

export interface FileEntry {
  relativePath: string;
  absolutePath: string;
}

export type DiffCategory =
  | 'config-drift'
  | 'version-drift'
  | 'missing-from-target'
  | 'addition'
  | 'custom-code'
  | 'identical';

export interface FileDiff {
  relativePath: string;
  category: DiffCategory;
  templateContent?: string;
  targetContent?: string;
  diffSummary?: string;
  versionDiffs?: VersionDiff[];
}

export interface VersionDiff {
  package: string;
  templateVersion: string;
  targetVersion: string;
}

export interface ComparisonReport {
  generatedAt: string;
  templatePath: string;
  targetPath: string;
  projectName: string;
  summary: ReportSummary;
  diffs: FileDiff[];
}

export interface ReportSummary {
  totalTemplateFiles: number;
  totalTargetFiles: number;
  identical: number;
  configDrift: number;
  versionDrift: number;
  missingFromTarget: number;
  additions: number;
  customCode: number;
}
