export interface ScaffoldOptions {
  projectName: string;
  targetDir: string;
  skipGit?: boolean;
  skipInstall?: boolean;
}

export interface ReplacementConfig {
  projectName: string;
  projectNameKebab: string;
  projectNamePascal: string;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
}
