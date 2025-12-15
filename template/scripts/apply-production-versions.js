#!/usr/bin/env node
/**
 * Replaces workspace:* dependencies with pinned npm versions
 * for production Docker builds.
 */
const fs = require('fs');
const path = require('path');

const versionsFile = path.join(__dirname, '..', 'versions.production.json');
const versions = JSON.parse(fs.readFileSync(versionsFile, 'utf8'));

const packageFiles = [
  'apps/api/package.json',
  'apps/web/package.json',
];

for (const file of packageFiles) {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) continue;

  const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let modified = false;

  for (const [dep, version] of Object.entries(versions)) {
    if (pkg.dependencies?.[dep] === 'workspace:*') {
      pkg.dependencies[dep] = version;
      modified = true;
      console.log(`${file}: ${dep} → ${version}`);
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n');
  }
}

console.log('Production versions applied.');
