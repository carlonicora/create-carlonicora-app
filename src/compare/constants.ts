// Patterns to ignore during comparison (relative to root)
export const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  '.turbo',
  'dist',
  '.next',
  'pnpm-lock.yaml',
  '.env',
  '.env.local',
  '.env.e2e',
  '.DS_Store',
  '.claude',
  '.beads',
  '.vscode',
  '.idea',
  'coverage',
  '*.log',
  'test-results',
  'playwright-report',
  '.tsbuildinfo',
  'REST.http',
  '.worktrees',
  // Target-specific directories that are project additions (not compared)
  'docs',
  'structure',
  'reports',
  'infrastructure',
  'openspec',
  'models',
  '__tests__',
  // Application source code (project-specific, not template)
  'apps/api/src',
  'apps/api/.cache',
  'apps/api/templates',
  'apps/api/scripts',
  'apps/api/config',
  'apps/web/public',
  'apps/web/messages',
  'apps/web/__tests__',
  'apps/web/src/app/[locale]/(main)/(features)',
  'apps/web/src/app/[locale]/(marketing)',
  'apps/web/src/app/[locale]/(blocked)',
  'apps/web/src/app/[locale]/(persons)',
  'apps/web/src/components',
  '.husky/_',
  '.ruff_cache',
  '.DS_Store',
  'Dockerfile.backup',
  // Note: apps/web/src/features/* is excluded EXCEPT features/common (handled in file-collector)
  // Library packages (git submodules in template, full implementations in target)
  'packages/nestjs-neo4jsonapi',
  'packages/nextjs-jsonapi',
  // Shared package source (project-specific implementations)
  'packages/shared/src',
  // Documentation files (project-specific, never sync to template)
  'CHANGELOG.md',
  'README.md',
];

// Patterns that should be ignored anywhere in the path
export const ANYWHERE_IGNORE_PATTERNS = [
  'node_modules',
  'dist',
  '.turbo',
  '.next',
  'coverage',
  'test-results',
  'playwright-report',
  '.DS_Store',
  '.ruff_cache',
];

// Binary file extensions that should not be processed for text comparison
export const BINARY_EXTENSIONS = new Set([
  // Images
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.svg',
  '.bmp',
  '.tiff',
  // Fonts
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
  // Archives
  '.tar',
  '.zip',
  '.gz',
  '.rar',
  '.7z',
  // Documents
  '.pdf',
  // Lock files
  '.lock',
  // Other binary formats
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  // ML models
  '.onnx',
  '.bin',
  '.safetensors',
]);

// Files that are configuration files (for categorization)
export const CONFIG_FILE_PATTERNS = [
  'package.json',
  'tsconfig.json',
  'tsconfig.base.json',
  'tsconfig.build.json',
  'turbo.json',
  'vitest.config.ts',
  'vitest.setup.ts',
  'eslint.config.mjs',
  'playwright.config.ts',
  'next.config.js',
  'nest-cli.json',
  'jest.config.js',
  '.prettierrc',
  'prettierrc',
  '.prettierignore',
  'prettierignore',
  '.releaserc',
  'releaserc',
  '.npmrc',
  'npmrc',
  '.gitignore',
  'gitignore',
  '.gitmodules',
  'gitmodules',
  'docker-compose.yml',
  'docker-compose.api.yml',
  'docker-compose.web.yml',
  'docker-compose.worker.yml',
  'Dockerfile',
  'components.json',
  'postcss.config.mjs',
  'pnpm-workspace.yaml',
  '.swcrc',
  'swcrc',
  'next-env.d.ts',
  'global.d.ts',
];

// Paths that contain application code (for categorization)
// Note: apps/api/src, apps/web/src/features/* (except common), and packages/shared/src are excluded
export const CODE_PATHS = ['apps/web/src/', 'apps/web/src/features/common/'];

// Dotfile rename mapping (template stores without dot, target has dot)
export const DOTFILE_RENAMES: Record<string, string> = {
  gitignore: '.gitignore',
  gitmodules: '.gitmodules',
  prettierrc: '.prettierrc',
  prettierignore: '.prettierignore',
  npmrc: '.npmrc',
  releaserc: '.releaserc',
  swcrc: '.swcrc',
  'env.example': '.env.example',
};

// Files that should be compared for version drift
export const VERSION_FILES = ['package.json', 'versions.production.json'];

// Maximum file size to show full diff (1MB)
export const MAX_DIFF_FILE_SIZE = 1024 * 1024;
