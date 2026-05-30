#!/usr/bin/env node

/**
 * Template Sync Script
 *
 * This script syncs the template files from the neural-erp source project
 * to the embedded template directory in the bootstrapper.
 *
 * It replaces all "neural-erp" references with placeholders like {{name}}
 * which will be replaced with the actual project name during scaffolding.
 *
 * Usage: node scripts/sync-template.js [source-path]
 *
 * If no source path is provided, it defaults to /Users/carlo/Development/neural-erp
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { generalize } from '../dist/core-update/generalizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE = process.argv[2] || '/Users/carlo/Development/neural-erp';
const TEMPLATE_DEST = path.join(__dirname, '..', 'template');

// Patterns to ignore (relative to source root)
const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  '.turbo',
  'dist',
  '.next',
  'pnpm-lock.yaml',
  '.env',
  '.DS_Store',
  '.claude',
  'packages/nestjs-neo4jsonapi',
  'packages/nextjs-jsonapi',
  '.husky/_',
  'coverage',
  '*.log',
  'test-results',
  'playwright-report',
  '.tsbuildinfo',
  'REST.http',
  // business feature modules (web + api)
  'apps/web/src/features/activity', 'apps/web/src/features/asset',
  'apps/web/src/features/catalog', 'apps/web/src/features/consumable',
  'apps/web/src/features/content', 'apps/web/src/features/crm',
  'apps/web/src/features/finance', 'apps/web/src/features/hr',
  'apps/web/src/features/label', 'apps/web/src/features/logistic',
  'apps/web/src/features/operations', 'apps/web/src/features/plm',
  'apps/web/src/features/procurement', 'apps/web/src/features/project',
  'apps/web/src/features/sales', 'apps/web/src/features/warehouse',
  'apps/api/src/features/activity', 'apps/api/src/features/asset',
  'apps/api/src/features/catalog', 'apps/api/src/features/consumable',
  'apps/api/src/features/content', 'apps/api/src/features/crm',
  'apps/api/src/features/finance', 'apps/api/src/features/hr',
  'apps/api/src/features/logistic', 'apps/api/src/features/operations',
  'apps/api/src/features/plm', 'apps/api/src/features/procurement',
  'apps/api/src/features/project', 'apps/api/src/features/sales',
  'apps/api/src/features/warehouse', 'apps/api/src/features/rbac',
  // business app routes
  'apps/web/src/app/[locale]/(main)/(features)',
  // project-specific admin pages (how-to admin UI)
  'apps/web/src/app/[locale]/(admin)/administration/howtos',
  // project tooling & content
  'migrations', 'scripts/migrations',
  'scripts/generate-invoice-templates.mjs', 'scripts/__tests__',
  'apps/api/src/scripts', 'apps/api/src/__tests__', 'apps/api/test',
  'apps/web/tests',
  'apps/api/src/rbac', 'apps/web/messages/it.json',
  'apps/web/public/logo.webp', 'apps/web/public/favicon.ico',
  'apps/web/public/neural-erp.png', 'apps/web/public/icons', 'apps/web/public/splash',
  'openspec', 'docs', 'CLAUDE_OLD.md', 'CORE-UPDATE.md', 'EXTEND-USER.md',
  'REST.http', 'structure', 'CHANGELOG.md', '.opencode', '.playwright-cli',
  // project-specific neo4j migrations (001-004 are framework bootstrap; 005+ are project)
  'apps/api/src/neo4j.migrations/20250901_005.ts',
  'apps/api/src/neo4j.migrations/20250901_006.ts',
  'apps/api/src/neo4j.migrations/20250901_007.ts',
  // project-specific shared package content
  'packages/shared/src/const', 'packages/shared/src/money',
  'packages/shared/src/pricing', 'packages/shared/src/invoice',
  'packages/shared/src/schemas', 'packages/shared/src/index.ts',
  // global components only used by business modules
  'apps/web/src/components',
  // STRIP files inside otherwise-synced folders: consumed only by business
  // modules or by stripped shared helpers (per the consumer audit). Without
  // these, the sync would re-introduce broken/dead files into the template.
  'apps/web/src/features/common/components/widgets',
  'apps/web/src/features/common/components/forms',
  'apps/web/src/features/common/data',
  'apps/web/src/features/common/components/containers/CompanyConfigurationEditorContainer.tsx',
  'apps/web/src/features/common/components/containers/FeatureContainer.tsx',
  'apps/web/src/features/common/components/containers/ModulePreviewCard.tsx',
  'apps/web/src/features/common/components/details/IndexCard.tsx',
  'apps/web/src/features/common/components/navigations/FavouriteToggle.tsx',
  'apps/web/src/features/common/contexts/FeatureContext.tsx',
  'apps/web/src/foundations',
  'apps/web/src/hooks/useCamera.ts',
  'apps/web/src/utils/currency.ts',
  'apps/web/src/utils/__tests__',
  'apps/api/src/features/shared',
];

// Hand-maintained in template/. The sync must never copy neural-erp's version
// over these (STAY baselines, LIFT-WITH-EDITS edited files, LIFT-AS-STUB stubs).
const PROTECTED_PATHS = [
  // STAY
  'apps/web/src/app/globals.css',
  'apps/web/src/enums/feature.ids.ts',
  'apps/web/src/features/common/components/containers/IndexContainer.tsx',
  'apps/web/src/app/[locale]/(main)/(foundations)/users/[id]/page.tsx',
  'apps/api/src/config/config.ts',
  'apps/api/src/config/enums/job.name.ts',
  'apps/api/src/config/enums/queue.id.ts',
  'packages/shared/src/const/roles.id.ts',
  'apps/api/src/neo4j.migrations/20250901_003.ts',
  'README.md',
  // LIFT-WITH-EDITS (hand-maintained edited versions)
  'apps/web/src/features/common/components/navigations/sidebar.items.tsx',
  'apps/web/src/features/common/components/navigations/CommonSidebar.tsx',
  'apps/web/src/features/common/components/navigations/UserSidebarFooter.tsx',
  'apps/web/src/features/common/components/containers/SettingsContainer.tsx',
  'apps/web/src/features/common/components/details/LayoutDetails.tsx',
  'apps/web/src/config/Bootstrapper.ts',
  'apps/web/src/config/env.ts',
  'apps/web/src/i18n/routing.ts',
  'apps/web/src/app/[locale]/(main)/layout.tsx',
  'apps/web/src/app/[locale]/(main)/page.tsx',
  'apps/web/next.config.js', 'apps/web/eslint.config.mjs', 'apps/web/playwright.config.ts',
  'package.json', 'apps/api/package.json', 'apps/web/package.json', 'packages/shared/package.json',
  'pnpm-workspace.yaml', 'env.example', 'scripts/update.sh',
  'docker-compose.yml', 'docker-compose.api.yml', 'docker-compose.web.yml', 'docker-compose.worker.yml',
  'CLAUDE.md', 'AGENTS.md', 'apps/api/CLAUDE.md', 'apps/web/CLAUDE.md', 'packages/shared/CLAUDE.md',
  // LIFT-AS-STUB
  'apps/web/src/features/common/components/containers/AdminIndexContainer.tsx',
  'apps/web/src/features/common/components/navigations/QuickCreateMenu.tsx',
  'apps/web/src/features/common/components/navigations/CreationDropDown.tsx',
  'apps/api/src/features/essentials/search/repositories/search.repository.ts',
  // module registry: template ships an essentials + RBAC baseline; neural-erp's
  // version imports every business module.
  'apps/api/src/features/features.modules.ts',
  // generic framework-only RBAC baseline — neural-erp's versions enumerate all
  // 48 business modules, so these must be hand-maintained and never overwritten.
  'packages/shared/src/const/module.id.ts',
  'apps/api/src/rbac/permissions.ts',
  'apps/api/src/rbac/module-id.map.json',
  'apps/api/src/features/rbac/module-relationships.map.ts',
];

// Binary file extensions that should not be processed for text replacement
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.bmp', '.tiff',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.tar', '.zip', '.gz', '.rar', '.7z',
  '.pdf', '.lock',
  '.exe', '.dll', '.so', '.dylib',
]);

function shouldIgnore(relativePath) {
  if (PROTECTED_PATHS.includes(relativePath.replace(/\\/g, '/'))) return true;

  const normalizedPath = relativePath.replace(/\\/g, '/');
  const pathParts = normalizedPath.split('/');

  const ANYWHERE_PATTERNS = ['node_modules', 'dist', '.turbo', '.next', 'coverage', 'test-results', 'playwright-report', '.opencode', '.playwright-cli', '.llm-dumps'];

  for (const pattern of ANYWHERE_PATTERNS) {
    if (pathParts.includes(pattern)) return true;
  }

  for (const pattern of IGNORE_PATTERNS) {
    if (normalizedPath === pattern) return true;
    if (normalizedPath.startsWith(pattern + '/')) return true;
    if (pattern.endsWith('/') && normalizedPath.startsWith(pattern)) return true;
    if (pattern.startsWith('*.')) {
      const ext = pattern.slice(1);
      if (normalizedPath.endsWith(ext)) return true;
    }
    if (pattern === '.tsbuildinfo' && normalizedPath.endsWith('.tsbuildinfo')) return true;
  }

  return false;
}

function isBinaryFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

function applyPlaceholders(content) {
  return generalize(content, 'neural-erp');
}

function copyRecursive(src, dest, baseSrc) {
  const relativePath = path.relative(baseSrc, src);

  if (relativePath && shouldIgnore(relativePath)) {
    console.log(`  Skipping: ${relativePath}`);
    return;
  }

  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyRecursive(
        path.join(src, entry),
        path.join(dest, entry),
        baseSrc
      );
    }
  } else {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    if (isBinaryFile(src)) {
      // Binary file - copy as-is
      fs.copyFileSync(src, dest);
    } else {
      // Text file - apply placeholder replacements
      try {
        let content = fs.readFileSync(src, 'utf-8');
        content = applyPlaceholders(content);
        fs.writeFileSync(dest, content, 'utf-8');
      } catch (error) {
        // If reading as text fails, copy as binary
        fs.copyFileSync(src, dest);
      }
    }

    if (relativePath) {
      console.log(`  Copied: ${relativePath}`);
    }
  }
}

function renameEnvExample(templateDir) {
  const oldPath = path.join(templateDir, '.env example');
  const newPath = path.join(templateDir, '.env.example');

  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
    console.log('  Renamed: ".env example" -> ".env.example"');
  }
}

// Rename dotfiles so npm doesn't strip them during publish
// They'll be renamed back during scaffolding
const DOTFILES_TO_RENAME = [
  '.gitignore',
  '.gitmodules',
  '.prettierrc',
  '.prettierignore',
  '.npmrc',
  '.releaserc',
  '.swcrc',
  '.env.example',
];

function renameDotfilesForNpm(dir) {
  for (const dotfile of DOTFILES_TO_RENAME) {
    const oldPath = path.join(dir, dotfile);
    const newName = dotfile.slice(1); // Remove leading dot
    const newPath = path.join(dir, newName);

    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
      console.log(`  Renamed: "${dotfile}" -> "${newName}"`);
    }
  }

  // Also handle nested directories (like apps/api, apps/web)
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      renameDotfilesForNpm(path.join(dir, entry.name));
    }
  }
}

function createPackagesDir(templateDir) {
  const packagesDir = path.join(templateDir, 'packages');
  if (!fs.existsSync(packagesDir)) {
    fs.mkdirSync(packagesDir, { recursive: true });
  }

  const submoduleDirs = ['nestjs-neo4jsonapi', 'nextjs-jsonapi'];
  for (const dir of submoduleDirs) {
    const submodulePath = path.join(packagesDir, dir);
    if (!fs.existsSync(submodulePath)) {
      fs.mkdirSync(submodulePath, { recursive: true });
    }
    fs.writeFileSync(path.join(submodulePath, '.gitkeep'), '');
    console.log(`  Created placeholder: packages/${dir}/.gitkeep`);
  }
}

async function main() {
  console.log('Template Sync Script');
  console.log('====================');
  console.log(`Source: ${SOURCE}`);
  console.log(`Destination: ${TEMPLATE_DEST}`);
  console.log();

  if (!fs.existsSync(SOURCE)) {
    console.error(`Error: Source directory not found: ${SOURCE}`);
    process.exit(1);
  }

  // Non-destructive: refresh only LIFT files in place. Judgment files
  // (STAY / LIFT-WITH-EDITS / LIFT-AS-STUB, listed in PROTECTED_PATHS) are
  // hand-maintained in template/ and must survive a sync.
  if (!fs.existsSync(TEMPLATE_DEST)) fs.mkdirSync(TEMPLATE_DEST, { recursive: true });

  console.log('Copying files and applying placeholders...');
  copyRecursive(SOURCE, TEMPLATE_DEST, SOURCE);

  console.log('\nPost-processing...');
  renameEnvExample(TEMPLATE_DEST);
  createPackagesDir(TEMPLATE_DEST);

  console.log('\nRenaming dotfiles for npm compatibility...');
  renameDotfilesForNpm(TEMPLATE_DEST);

  console.log('\n✅ Template synced successfully!');
  console.log('   All "neural-erp" references have been replaced with {{name}} placeholders.');
  console.log(`\nTemplate location: ${TEMPLATE_DEST}`);
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
