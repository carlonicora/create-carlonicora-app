# Core Update Workflow

This guide explains how to propose improvements from your application back to the bootstrapper template, generate portable patches, and apply updates from the bootstrapper.

## Overview

When you make improvements to your application's configuration, CI/CD, tooling, or other infrastructure, you can share those improvements with:

1. **The bootstrapper template** - So new projects get your improvements by default
2. **Other applications** - Via portable patch files that can be applied manually

```
                          YOUR WORKFLOW
                          =============

┌─────────────────┐     propose      ┌────────────────────┐
│   Your App      │  ─────────────►  │  .core-update-     │
│   (my-app)      │                  │  manifest.json     │
│                 │                  │  (local, gitignored)│
│  Make changes   │                  └────────────────────┘
└─────────────────┘                           │
                                              │ patch generate
                                              ▼
                              ┌────────────────────────────┐
                              │  patches/                  │
                              │  YYYY-MM-DD-slug.patch.json│
                              │  (submit via PR)           │
                              └────────────────────────────┘
                                              │
                                              │ PR to bootstrapper
                                              ▼
                              ┌────────────────────────────┐
                              │  create-carlonicora-app/   │
                              │  template/                 │
                              │  (generalized files)       │
                              └────────────────────────────┘
                                              │
                                              │ patch apply (from bootstrapper)
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
              ┌──────────┐             ┌──────────┐             ┌──────────┐
              │  App A   │             │  App B   │             │  App C   │
              └──────────┘             └──────────┘             └──────────┘
```

## The Workflow at a Glance

1. **Propose** - Stage files you want to share as core updates
2. **Review** - Preview what will be synced and how it will be generalized
3. **Generate** - Create a portable patch file
4. **Submit** - Send a PR to the bootstrapper repository
5. **Apply** - When patches come from the bootstrapper, apply them to your app

---

## Step 1: Propose Files for Update

When you've made an improvement worth sharing, stage it for a core update:

### Add a file to the proposal

```bash
npx create-carlonicora-app propose add <file> -d "<description>" -c <category>
```

**Example:**

```bash
npx create-carlonicora-app propose add .github/workflows/dev.yml \
  -d "Add automated test coverage reporting" \
  -c ci
```

**Output:**

```
Added to proposals:
  File: .github/workflows/dev.yml
  Description: Add automated test coverage reporting
  Category: ci
  ID: b1e2ce6e-fa9f-425f-a60f-3180cb70830d
```

### List current proposals

```bash
npx create-carlonicora-app propose list
```

**Output:**

```
Proposed updates for my-app:

  .github/workflows/dev.yml
    Add automated test coverage reporting
    Category: ci | Added: 2026-01-30

  tsconfig.base.json
    Enable strict null checks
    Category: config | Added: 2026-01-30

Total: 2 file(s)
```

### Remove a file from the proposal

```bash
npx create-carlonicora-app propose remove .github/workflows/dev.yml
```

**Output:**

```
Removed from proposals: .github/workflows/dev.yml
```

### Clear all proposals

```bash
npx create-carlonicora-app propose clear
```

**Output:**

```
Cleared 2 proposed update(s).
```

---

## Step 2: Review What Will Be Synced

Before generating a patch, preview how your files will be generalized:

```bash
npx create-carlonicora-app sync --proposed-only --dry-run
```

**Output:**

```
Sync to Template
  Source: /path/to/my-app
  Template: /path/to/create-carlonicora-app/template
  App name: my-app

Syncing 2 proposed file(s)...
  Would sync: .github/workflows/dev.yml
    Replacements:
      "my-app-api" -> "{{name}}-api" (3x)
      "my-app-web" -> "{{name}}-web" (2x)
      "\bmy-app\b" -> "{{name}}" (5x)

  Would sync: tsconfig.base.json
    Replacements:
      (no app-specific references found)

Dry run complete. Would sync 2 file(s).
```

### Understanding Generalization

The sync process replaces app-specific values with `{{name}}` placeholders:

| Your App Value | Generalized Value |
|----------------|-------------------|
| `my-app-api` | `{{name}}-api` |
| `my-app-web` | `{{name}}-web` |
| `@my-app/shared` | `@{{name}}/shared` |
| `api.my-app.test` | `api.{{name}}.test` |
| `NEO4J_DATABASE=my-app` | `NEO4J_DATABASE={{name}}` |

This ensures the template works for any project name.

---

## Step 3: Generate a Patch

Create a portable patch file from your proposals:

```bash
npx create-carlonicora-app patch generate -m "CI improvements and strict TypeScript"
```

**Output:**

```
Generating patch...
  Source: /path/to/my-app
  Files: 2

Patch generated successfully!
  ID: 2026-01-30-ci-improvements-and-strict-typesc
  Path: /path/to/create-carlonicora-app/patches/2026-01-30-ci-improvements-and-strict-typesc.patch.json
  Files: 2
  Categories: ci, config
```

### Generate from a different app location

```bash
npx create-carlonicora-app patch generate -m "Description" --from /path/to/other-app
```

---

## Step 4: Submit to Bootstrapper

After generating a patch, submit it to the bootstrapper repository:

### Option A: Submit Patch File (Recommended)

1. Fork/clone `create-carlonicora-app`
2. Copy your patch file to the `patches/` directory
3. Create a PR with:
   - **Title:** `feat: Add <brief description>`
   - **Description:**
     ```markdown
     ## Summary
     - <What this patch adds/improves>

     ## Files Changed
     - `file1.yml` - <what changed>
     - `file2.json` - <what changed>

     ## Testing
     - [ ] Applied to test project successfully
     - [ ] Verified generalization is correct
     ```

### Option B: Direct Sync (If You Have Repo Access)

If you have access to the bootstrapper repo:

```bash
# From your app directory
npx create-carlonicora-app sync --proposed-only
```

This directly updates the template files. Then commit and push.

---

## Step 5: Applying Patches from Bootstrapper

When improvements are available from the bootstrapper, apply them to your app:

### List available patches

```bash
npx create-carlonicora-app patch list
```

**Output:**

```
Available patches:

  2026-01-30-ci-improvements
    CI improvements and test coverage
    Files: 3 | From: other-app | Date: 2026-01-30

  2026-01-28-docker-optimization
    Optimize Docker build layers
    Files: 2 | From: another-app | Date: 2026-01-28
```

### View patch details

```bash
npx create-carlonicora-app patch show 2026-01-30-ci-improvements
```

**Output:**

```
Patch: 2026-01-30-ci-improvements

  Description: CI improvements and test coverage
  Source App: other-app
  Created: 2026-01-30T10:15:00Z
  Categories: ci

Files:
  .github/workflows/dev.yml [modify]
    Add test coverage reporting
  .github/workflows/pr.yml [add]
    Add PR validation workflow
  codecov.yml [add]
    Configure Codecov
```

### Preview patch application (dry-run)

```bash
npx create-carlonicora-app patch apply 2026-01-30-ci-improvements --dry-run
```

**Output:**

```
Applying patch: 2026-01-30-ci-improvements
  Target: /path/to/my-app

  Project name: my-app

Would apply:
  .github/workflows/pr.yml
  codecov.yml

Would conflict:
  .github/workflows/dev.yml
    File exists with different content

Dry run complete. No changes made.
```

### Apply the patch

```bash
npx create-carlonicora-app patch apply 2026-01-30-ci-improvements
```

**Output:**

```
Applying patch: 2026-01-30-ci-improvements
  Target: /path/to/my-app

Applied:
  .github/workflows/pr.yml
  codecov.yml

Conflicts (skipped):
  .github/workflows/dev.yml
    File exists with different content

Use --force to overwrite conflicting files.

Patch partially applied. 1 conflict(s).
```

### Force overwrite conflicts

If you want to overwrite conflicting files:

```bash
npx create-carlonicora-app patch apply 2026-01-30-ci-improvements --force
```

### Apply to a different location

```bash
npx create-carlonicora-app patch apply 2026-01-30-ci-improvements --target /path/to/other-project
```

---

## Category Reference

When proposing files, use these categories:

| Category | Description | Examples |
|----------|-------------|----------|
| `config` | Configuration files | `tsconfig.json`, `eslint.config.js`, `.prettierrc` |
| `ci` | CI/CD workflows | `.github/workflows/*.yml`, `.gitlab-ci.yml` |
| `dx` | Developer experience | Editor configs, debugging tools, dev scripts |
| `scripts` | Utility scripts | `scripts/*.sh`, build helpers |
| `docker` | Docker configuration | `Dockerfile`, `docker-compose*.yml` |
| `docs` | Documentation | `*.md` files (except README) |
| `other` | Miscellaneous | Anything that doesn't fit above |

---

## Technical Details

### The Manifest File

Proposals are stored in `.core-update-manifest.json` in your project root:

```json
{
  "version": "1.0.0",
  "appName": "my-app",
  "proposedUpdates": [
    {
      "id": "uuid-v4",
      "filePath": ".github/workflows/dev.yml",
      "description": "Add test coverage reporting",
      "category": "ci",
      "addedAt": "2026-01-30T10:00:00Z"
    }
  ],
  "appliedPatches": [],
  "metadata": {
    "lastModified": "2026-01-30T10:00:00Z"
  }
}
```

This file is gitignored by default - proposals are local to your machine until you generate a patch.

### Generalization Patterns

The system uses priority-ordered replacement patterns to avoid double-replacement:

1. **Package names** (highest priority): `my-app-api` -> `{{name}}-api`
2. **Scoped packages**: `@my-app/shared` -> `@{{name}}/shared`
3. **URLs/Hostnames**: `api.my-app.test` -> `api.{{name}}.test`
4. **Database/Services**: `NEO4J_DATABASE=my-app` -> `NEO4J_DATABASE={{name}}`
5. **Generic word boundary** (lowest priority): `my-app` -> `{{name}}`

High-priority patterns are applied first to prevent `my-app-api` from becoming `{{name}}-{{name}}`.

### Patch File Format

Patches are JSON files containing:

```json
{
  "version": "1.0.0",
  "metadata": {
    "id": "2026-01-30-ci-improvements",
    "createdAt": "2026-01-30T10:15:00Z",
    "sourceApp": "my-app",
    "description": "CI improvements",
    "categories": ["ci"],
    "fileCount": 2
  },
  "files": [
    {
      "path": ".github/workflows/dev.yml",
      "operation": "modify",
      "description": "Add test coverage",
      "category": "ci",
      "content": "...(generalized content)...",
      "contentHash": "sha256:abc123..."
    }
  ],
  "replacements": [
    {"pattern": "my-app-api", "replacement": "{{name}}-api"}
  ]
}
```

---

## Command Reference

### Propose Commands

| Command | Description |
|---------|-------------|
| `propose add <file> -d "<desc>" -c <cat>` | Add file to proposal |
| `propose remove <file>` | Remove file from proposal |
| `propose list` | List all proposed files |
| `propose clear` | Clear all proposals |

### Sync Commands

| Command | Description |
|---------|-------------|
| `sync --proposed-only --dry-run` | Preview sync |
| `sync --proposed-only` | Sync to template |
| `sync --from <path> --proposed-only` | Sync from specific app |

### Patch Commands

| Command | Description |
|---------|-------------|
| `patch generate -m "<message>"` | Generate patch from proposals |
| `patch generate -m "<msg>" --from <path>` | Generate from specific app |
| `patch list` | List available patches |
| `patch show <id>` | Show patch details |
| `patch apply <id>` | Apply patch |
| `patch apply <id> --dry-run` | Preview patch application |
| `patch apply <id> --force` | Apply and overwrite conflicts |
| `patch apply <id> --target <path>` | Apply to specific location |

---

## Troubleshooting

### "File not found" when proposing

The file path must be relative to your project root:

```bash
# Wrong
npx create-carlonicora-app propose add /absolute/path/file.yml -d "..." -c ci

# Correct
npx create-carlonicora-app propose add .github/workflows/file.yml -d "..." -c ci
```

### "Invalid category" error

Use one of the valid categories: `config`, `ci`, `dx`, `scripts`, `docker`, `docs`, `other`

### "No files proposed" when generating patch

Make sure you've proposed files first:

```bash
npx create-carlonicora-app propose list  # Check proposals
npx create-carlonicora-app propose add <file> -d "..." -c <category>
```

### Conflicts when applying patch

Options:
1. **Review manually**: Compare your file with the patch content
2. **Force overwrite**: Use `--force` if you want the patch version
3. **Skip**: Don't use `--force` - the file will be skipped

### Patch not specializing correctly

Ensure your target project has a valid `package.json` with a `name` field. The patch system reads the project name from there.
