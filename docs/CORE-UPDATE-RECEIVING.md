# Core Update Workflow - Receiving Patches

This guide is for maintainers of `create-carlonicora-app`. It explains how to receive, review, and process patches submitted by developers using applications scaffolded from this bootstrapper.

## Overview

When developers make improvements to their applications (CI/CD, configuration, tooling, etc.), they can share those improvements back via patches. As a maintainer, your role is to:

1. **Review** incoming patches for quality and compatibility
2. **Apply** patches to the template (or to test applications)
3. **Publish** approved patches so other applications can benefit

```
                    MAINTAINER WORKFLOW
                    ====================

┌──────────────────────────────────────────────────────────────────┐
│                     create-carlonicora-app                        │
│                                                                  │
│  1. RECEIVE                 2. REVIEW                            │
│  ┌─────────────────┐       ┌─────────────────┐                   │
│  │  PR submitted   │  ───► │  patch list     │                   │
│  │  with patch     │       │  patch show <id>│                   │
│  └─────────────────┘       └─────────────────┘                   │
│                                   │                              │
│                                   ▼                              │
│                            3. TEST                               │
│                            ┌─────────────────┐                   │
│                            │  patch apply    │                   │
│                            │  --dry-run      │                   │
│                            │  --target /test │                   │
│                            └─────────────────┘                   │
│                                   │                              │
│                                   ▼                              │
│                            4. MERGE & SYNC                       │
│                            ┌─────────────────┐                   │
│                            │  sync to        │                   │
│                            │  template/      │                   │
│                            └─────────────────┘                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                                   │
                                   │ Available to all apps
                                   ▼
              ┌─────────────────────────────────────────┐
              │           Other Applications            │
              │                                         │
              │   patch list → patch apply <id>         │
              └─────────────────────────────────────────┘
```

## Receiving Patches

### How Patches Arrive

Patches are submitted via Pull Requests to this repository. A typical PR includes:

- A new patch file in `patches/` directory
- PR description explaining the changes
- Information about the source application

### Patch Storage

All patches are stored in the `patches/` directory:

```
create-carlonicora-app/
└── patches/
    ├── .gitkeep
    ├── 2026-01-30-ci-improvements.patch.json
    ├── 2026-01-28-docker-optimization.patch.json
    └── 2026-01-25-typescript-strict-mode.patch.json
```

### Patch File Format

Each patch is a JSON file containing:

```json
{
  "version": "1.0.0",
  "metadata": {
    "id": "2026-01-30-ci-improvements",
    "createdAt": "2026-01-30T10:15:00Z",
    "sourceApp": "my-app",
    "description": "CI improvements and test coverage",
    "categories": ["ci", "dx"],
    "fileCount": 3
  },
  "files": [
    {
      "path": ".github/workflows/dev.yml",
      "operation": "modify",
      "description": "Add test coverage reporting",
      "category": "ci",
      "content": "...(generalized content with {{name}} placeholders)...",
      "contentHash": "sha256:abc123def456..."
    }
  ],
  "replacements": [
    {"pattern": "my-app-api", "replacement": "{{name}}-api"},
    {"pattern": "my-app-web", "replacement": "{{name}}-web"}
  ]
}
```

---

## Reviewing Patches

### List All Available Patches

```bash
npx create-carlonicora-app patch list
```

**Output:**

```
Available patches:

  2026-01-30-ci-improvements
    CI improvements and test coverage
    Files: 3 | From: my-app | Date: 2026-01-30

  2026-01-28-docker-optimization
    Optimize Docker build layers
    Files: 2 | From: another-app | Date: 2026-01-28

  2026-01-25-typescript-strict-mode
    Enable strict TypeScript mode
    Files: 5 | From: third-app | Date: 2026-01-25
```

### View Patch Details

```bash
npx create-carlonicora-app patch show 2026-01-30-ci-improvements
```

**Output:**

```
Patch: 2026-01-30-ci-improvements

  Description: CI improvements and test coverage
  Source App: my-app
  Created: 2026-01-30T10:15:00Z
  Categories: ci, dx

Files:
  .github/workflows/dev.yml [modify]
    Add test coverage reporting
  .github/workflows/pr.yml [add]
    Add PR validation workflow
  codecov.yml [add]
    Configure Codecov integration
```

### What to Review

When reviewing a patch, consider:

| Aspect | Questions to Ask |
|--------|------------------|
| **Relevance** | Does this improvement benefit all applications? |
| **Quality** | Is the code well-structured and maintainable? |
| **Compatibility** | Will this work with existing template files? |
| **Security** | Does this introduce any security concerns? |
| **Generalization** | Are all app-specific references properly replaced with `{{name}}`? |

### Inspect Patch Content Directly

For detailed review, open the patch JSON file directly:

```bash
cat patches/2026-01-30-ci-improvements.patch.json | jq '.files[].path'
```

Or view specific file content:

```bash
cat patches/2026-01-30-ci-improvements.patch.json | jq '.files[0].content'
```

---

## Testing Patches

### Preview Application (Dry Run)

Before applying, preview what would change:

```bash
npx create-carlonicora-app patch apply 2026-01-30-ci-improvements --dry-run
```

**Output:**

```
Applying patch: 2026-01-30-ci-improvements
  Target: /path/to/create-carlonicora-app

  Project name: create-carlonicora-app

Would apply:
  .github/workflows/pr.yml
  codecov.yml

Would conflict:
  .github/workflows/dev.yml
    File exists with different content

Dry run complete. No changes made.
```

### Apply to Test Application

Create a test application and apply the patch:

```bash
# Create a fresh test app
npx create-carlonicora-app test-app --skip-install

# Apply the patch to the test app
npx create-carlonicora-app patch apply 2026-01-30-ci-improvements --target ./test-app

# Verify the changes
cd test-app
git diff  # See applied changes
```

### Apply with Force (Overwrite Conflicts)

If you've reviewed the conflicts and want to accept the patch version:

```bash
npx create-carlonicora-app patch apply 2026-01-30-ci-improvements --target ./test-app --force
```

---

## Conflict Resolution

### What Causes Conflicts

A conflict occurs when:
- The target file exists AND
- The content differs from the patch (compared by SHA256 hash)

### Resolution Strategies

| Strategy | When to Use | Command |
|----------|-------------|---------|
| **Skip** | Keep existing file | Default behavior (no `--force`) |
| **Overwrite** | Accept patch version entirely | `--force` |
| **Manual Merge** | Combine changes | Edit file manually after reviewing diff |

### Comparing Content

To manually compare:

1. Extract patch content:
   ```bash
   cat patches/2026-01-30-ci-improvements.patch.json | jq -r '.files[] | select(.path == ".github/workflows/dev.yml") | .content' > patch-version.yml
   ```

2. Compare with existing:
   ```bash
   diff template/.github/workflows/dev.yml patch-version.yml
   ```

3. Decide: merge manually, skip, or force overwrite

---

## Syncing to Template

### Direct Sync from Source App

If the patch submitter has access and provides their app path:

```bash
npx create-carlonicora-app sync --from /path/to/their-app --proposed-only --dry-run
```

Then without `--dry-run` to apply:

```bash
npx create-carlonicora-app sync --from /path/to/their-app --proposed-only
```

This directly updates files in `template/` with properly generalized content.

### Manual Template Update

Alternatively, after testing a patch:

1. Apply patch to a test app
2. Copy generalized files to `template/`
3. Verify `{{name}}` placeholders are correct

---

## Category Reference

Patches are categorized to help with review and organization:

| Category | Description | Typical Files |
|----------|-------------|---------------|
| `config` | Configuration files | `tsconfig.json`, `eslint.config.js`, `.prettierrc`, `turbo.json` |
| `ci` | CI/CD workflows | `.github/workflows/*.yml`, `.gitlab-ci.yml` |
| `dx` | Developer experience | `.vscode/settings.json`, debug configs, dev tooling |
| `scripts` | Utility scripts | `scripts/*.sh`, `scripts/*.js` |
| `docker` | Docker configuration | `Dockerfile`, `docker-compose*.yml`, `.dockerignore` |
| `docs` | Documentation | `*.md` (excluding README), architecture docs |
| `other` | Miscellaneous | Anything not fitting above categories |

### Review Priority by Category

| Priority | Categories | Reason |
|----------|------------|--------|
| High | `ci`, `docker` | Affects all environments and deployments |
| Medium | `config`, `dx` | Affects developer workflow |
| Lower | `scripts`, `docs`, `other` | More isolated impact |

---

## CI Automation (Future Enhancement)

For automated patch propagation, consider this GitHub workflow:

### `.github/workflows/core-update-pr.yml`

```yaml
name: Core Update PRs

on:
  push:
    paths: ['patches/*.patch.json']
    branches: [main]

jobs:
  create-prs:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: ${{ fromJson(vars.REGISTERED_APPS) }}
    steps:
      - uses: actions/checkout@v4

      - name: Get new patches
        id: patches
        run: |
          PATCHES=$(git diff --name-only HEAD~1 | grep patches/)
          echo "patches=$PATCHES" >> $GITHUB_OUTPUT

      - uses: actions/checkout@v4
        with:
          repository: carlonicora/${{ matrix.app }}
          path: target
          token: ${{ secrets.APP_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Apply patches
        run: |
          npx create-carlonicora-app patch apply ${{ steps.patches.outputs.patches }} --target ./target

      - uses: peter-evans/create-pull-request@v6
        with:
          path: target
          title: "Core Update: ${{ steps.patches.outputs.patches }}"
          branch: core-update/${{ github.sha }}
          body: |
            Automated core update from create-carlonicora-app

            Patch: ${{ steps.patches.outputs.patches }}
```

### Setup Requirements

1. Create `REGISTERED_APPS` repository variable with JSON array of app names
2. Create `APP_TOKEN` secret with access to target repositories
3. Enable workflow permissions for PR creation

---

## Command Reference

### Patch Commands (For Maintainers)

| Command | Description |
|---------|-------------|
| `patch list` | List all available patches |
| `patch show <id>` | Show patch details |
| `patch apply <id> --dry-run` | Preview what would be applied |
| `patch apply <id>` | Apply to current directory |
| `patch apply <id> --target <path>` | Apply to specific location |
| `patch apply <id> --force` | Apply and overwrite conflicts |

### Sync Commands (For Direct Template Updates)

| Command | Description |
|---------|-------------|
| `sync --from <path> --proposed-only --dry-run` | Preview sync from app |
| `sync --from <path> --proposed-only` | Sync proposed files to template |

---

## Workflow Checklist

When processing a patch PR:

- [ ] Review PR description and patch metadata
- [ ] Run `patch list` and `patch show <id>` to inspect
- [ ] Run `patch apply <id> --dry-run` to preview
- [ ] Test on a fresh application: `patch apply <id> --target ./test-app`
- [ ] Verify `{{name}}` placeholders are correct in patch content
- [ ] Check for security concerns
- [ ] Resolve any conflicts (manual merge or force)
- [ ] Merge PR if approved
- [ ] (Optional) Sync to template if not already done

---

## Troubleshooting

### "Patch file not found"

Ensure the patch ID matches exactly:

```bash
# List available patches to get exact IDs
npx create-carlonicora-app patch list

# Use the exact ID shown
npx create-carlonicora-app patch show 2026-01-30-ci-improvements
```

### "Cannot detect project name"

The target directory must have a `package.json` with a `name` field:

```bash
# Check the target has package.json
cat /path/to/target/package.json | jq '.name'
```

### Patch Content Not Generalized

If you see app-specific values instead of `{{name}}`:

1. The patch was generated incorrectly
2. Ask submitter to regenerate with correct app name detection
3. Or manually edit the patch JSON

### Hash Mismatch on Already-Applied Files

If a patch reports conflict on files that look identical:

- Whitespace differences (line endings, trailing spaces)
- The template was updated after patch generation
- Regenerate the patch or force overwrite
