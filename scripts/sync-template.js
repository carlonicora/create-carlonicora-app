#!/usr/bin/env node

/**
 * Template Sync Script
 *
 * This script syncs the template files from the rpg source project
 * to the embedded template directory in the bootstrapper.
 *
 * It replaces all "rpg" references with placeholders like {{name}}
 * which will be replaced with the actual project name during scaffolding.
 *
 * Usage: node scripts/sync-template.js [source-path]
 *
 * If no source path is provided, it defaults to /Users/carlo/Development/rpg
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RPG_SOURCE = process.argv[2] || '/Users/carlo/Development/rpg';
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
];

// Binary file extensions that should not be processed for text replacement
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.bmp', '.tiff',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.tar', '.zip', '.gz', '.rar', '.7z',
  '.pdf', '.lock',
  '.exe', '.dll', '.so', '.dylib',
]);

// Replacements to convert "rpg" to placeholders (order matters - specific first)
const PLACEHOLDER_REPLACEMENTS = [
  // Package names
  { search: 'rpg-api', replace: '{{name}}-api' },
  { search: 'rpg-web', replace: '{{name}}-web' },
  { search: '@rpg/shared', replace: '@{{name}}/shared' },

  // Hostnames and URLs
  { search: 'api.rpg.test', replace: 'api.{{name}}.test' },
  { search: 'minio.rpg.test', replace: 'minio.{{name}}.test' },
  { search: 'rpg.test', replace: '{{name}}.test' },

  // Email addresses
  { search: 'admin@rpg.com', replace: 'admin@{{name}}.com' },
  { search: 'info@rpg.com', replace: 'info@{{name}}.com' },
  { search: 'rpg<info@rpg.com>', replace: '{{name}}<info@{{name}}.com>' },

  // Secrets and service names
  { search: 'rpg_SECRET', replace: '{{name}}_SECRET' },

  // Database and Redis
  { search: 'NEO4J_DATABASE=rpg', replace: 'NEO4J_DATABASE={{name}}' },
  { search: 'REDIS_QUEUE=rpg', replace: 'REDIS_QUEUE={{name}}' },
  { search: 'S3_BUCKET="rpg"', replace: 'S3_BUCKET="{{name}}"' },

  // Turbo task names
  { search: 'rpg-web#build', replace: '{{name}}-web#build' },

  // Config values with quotes
  { search: '"rpg"', replace: '"{{name}}"' },
  { search: "'rpg'", replace: "'{{name}}'" },

  // Logo references
  { search: '/rpg-logo', replace: '/{{name}}-logo' },
  { search: 'rpg-logo', replace: '{{name}}-logo' },

  // Remaining standalone "rpg" or "RPG" (word boundary, case insensitive)
  { search: /\brpg\b/gi, replace: '{{name}}' },
];

function shouldIgnore(relativePath) {
  const normalizedPath = relativePath.replace(/\\/g, '/');
  const pathParts = normalizedPath.split('/');

  const ANYWHERE_PATTERNS = ['node_modules', 'dist', '.turbo', '.next', 'coverage', 'test-results', 'playwright-report'];

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
  let result = content;

  for (const { search, replace } of PLACEHOLDER_REPLACEMENTS) {
    if (search instanceof RegExp) {
      result = result.replace(search, replace);
    } else {
      result = result.split(search).join(replace);
    }
  }

  return result;
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
  console.log(`Source: ${RPG_SOURCE}`);
  console.log(`Destination: ${TEMPLATE_DEST}`);
  console.log();

  if (!fs.existsSync(RPG_SOURCE)) {
    console.error(`Error: Source directory not found: ${RPG_SOURCE}`);
    process.exit(1);
  }

  console.log('Cleaning existing template...');
  if (fs.existsSync(TEMPLATE_DEST)) {
    fs.rmSync(TEMPLATE_DEST, { recursive: true, force: true });
  }
  fs.mkdirSync(TEMPLATE_DEST, { recursive: true });

  console.log('Copying files and applying placeholders...');
  copyRecursive(RPG_SOURCE, TEMPLATE_DEST, RPG_SOURCE);

  console.log('\nPost-processing...');
  renameEnvExample(TEMPLATE_DEST);
  createPackagesDir(TEMPLATE_DEST);

  console.log('\n✅ Template synced successfully!');
  console.log('   All "rpg" references have been replaced with {{name}} placeholders.');
  console.log(`\nTemplate location: ${TEMPLATE_DEST}`);
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
