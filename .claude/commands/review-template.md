---
allowed-tools: Bash, Read, Edit, Write, Glob, AskUserQuestion
argument-hint: "<target-project-path>"
description: Compare template against implemented project and interactively review differences
---

# Review Template

Interactively compare the bootstrapper template against an implemented project and guide the user through reviewing each difference.

## Purpose

This bootstrapper (`create-carlonicora-app`) generates new projects from a template. Over time, implemented projects evolve with improvements to configurations, workflows, and patterns. This command helps sync those improvements back to the template so future projects benefit.

**The goal is template evolution** - keeping the bootstrapper's template aligned with battle-tested patterns from production projects.

## What This Compares

The comparison script analyzes differences between:
- **Template**: `/Users/carlo/Development/create-carlonicora-app/template/`
- **Target**: The implemented project (e.g., Only35)

### Compared Areas
- Root configuration files (package.json, turbo.json, tsconfig, Docker files)
- GitHub workflows (`.github/workflows/`)
- Git hooks (`.husky/`)
- Web app configs (`apps/web/*.json`, `apps/web/*.config.*`)
- Shared package (`packages/shared/`)

### Excluded Areas (Project-Specific)
- `apps/api/src/` - API source code
- `apps/web/src/features/` - Web feature modules
- `packages/nestjs-neo4jsonapi/` - Library package (git submodule in template)
- `packages/nextjs-jsonapi/` - Library package (git submodule in template)
- `docs/`, `structure/`, `openspec/` - Project documentation

## Difference Categories

| Category | Meaning |
|----------|---------|
| **Config Drift** | Configuration files modified from template baseline |
| **Version Drift** | Only dependency versions changed (package.json) |
| **Custom Code** | Source files that differ from template |
| **Additions** | Files in target that don't exist in template |
| **Identical** | Files that match exactly (after placeholder resolution) |

## Template Placeholders

The template uses `{{name}}` placeholders that get replaced with the project name during scaffolding:
- `{{name}}-api` → `only35-api`
- `{{name}}-web` → `only35-web`
- `@{{name}}/shared` → `@only35/shared`
- `api.{{name}}.test` → `api.only35.test`

The comparison script automatically resolves these placeholders before comparing.

## Instructions

**CRITICAL RULE: Never ask a question without showing full context first.**

Before every AskUserQuestion, you MUST display:
1. The full template file content
2. The full target file content
3. A clear summary of what changed

The user cannot make decisions without seeing the actual content.

### Step 1: Validate Arguments

```bash
# Check target path provided
if [ -z "$ARGUMENTS" ]; then
  echo "ERROR: Target project path required"
  echo "Usage: /review-template /path/to/project"
  exit 1
fi

# Check target exists
ls -la $ARGUMENTS/package.json
```

If no argument provided, use AskUserQuestion to ask for the path.

### Step 2: Run Comparison

```bash
pnpm compare-template $ARGUMENTS --output /tmp/template-comparison.md
```

### Step 3: Read and Parse Report

```bash
cat /tmp/template-comparison.md
```

Parse the markdown report to extract:
1. Summary statistics
2. Config Drift files with their diffs
3. Custom Code files with their diffs
4. Additions grouped by category

### Step 4: Review Config Drift Files

For each file in the **Config Drift** section:

**IMPORTANT: Always show full context BEFORE asking the question.**

1. **Display the file being reviewed:**
   ```
   ═══════════════════════════════════════════════════════════════
   REVIEWING: .github/workflows/dev.yml
   ═══════════════════════════════════════════════════════════════
   ```

2. **Read and display BOTH versions side by side:**
   ```bash
   # Template version (remember dotfile renaming for dotfiles)
   cat /Users/carlo/Development/create-carlonicora-app/template/<path>
   ```

   ```bash
   # Target version
   cat $ARGUMENTS/<path>
   ```

3. **Show a clear diff summary:**
   ```
   CHANGES DETECTED:
   ────────────────────────────────────────────────────────────────

   Lines ADDED in target (not in template):
   + <line 1>
   + <line 2>

   Lines REMOVED from target (exists in template):
   - <line 1>

   Lines MODIFIED:
   Template: <old line>
   Target:   <new line>

   ────────────────────────────────────────────────────────────────
   ```

4. **ONLY AFTER showing all context above**, use AskUserQuestion:
   ```
   question: "What should we do with these changes?"
   header: "<filename>"
   options:
     - label: "Update template"
       description: "Apply these changes to the template"
     - label: "Keep template"
       description: "Template is correct, ignore target changes"
     - label: "Skip"
       description: "Decide later"
   ```

5. If "Update template" selected:
   - Read the target file
   - Convert project-specific values back to `{{name}}` placeholders
   - Handle dotfile renaming (`.gitignore` → `gitignore` in template)
   - Write to template directory

### Step 5: Review Custom Code Files

For each file in the **Custom Code** section, follow the same process as Step 4:
1. Display the file header
2. Show BOTH template and target file contents
3. Show clear diff summary
4. THEN ask the question

### Step 6: Review Additions (Optional)

For the **Additions** section:

1. Group additions by category (already grouped in report)
2. Use AskUserQuestion:
   ```
   question: "There are <N> additions in target. Review them?"
   header: "Additions"
   options:
     - label: "Review important ones"
       description: "Show root configs and workflow additions only"
     - label: "Review all"
       description: "Go through every addition"
     - label: "Skip additions"
       description: "Additions are project-specific, don't review"
   ```

### Step 7: Summary Report

After reviewing all files, display:

```
===============================================================
TEMPLATE REVIEW COMPLETE
===============================================================

Reviewed: <N> files
Updated template: <N> files
Kept template: <N> files
Skipped: <N> files

Files Updated:
- <list of files updated in template>

Next Steps:
1. Review changes: git diff template/
2. Test scaffolding: pnpm build && npx . test-project
3. Commit: git add template/ && git commit -m "chore: sync template with <project>"

===============================================================
```

### Step 8: Ask to Apply

Use AskUserQuestion:
```
question: "Would you like to commit these template changes?"
header: "Commit"
options:
  - label: "Yes, commit now"
    description: "Stage and commit template changes"
  - label: "No, I'll review first"
    description: "Leave changes unstaged for manual review"
```

## Updating Template Files

When updating a template file from the target:

### 1. Handle Placeholders

Replace project-specific values with `{{name}}`:

```typescript
// Target has:
"name": "only35"

// Template should have:
"name": "{{name}}"
```

Common replacements:
- Project name → `{{name}}`
- `<project>-api` → `{{name}}-api`
- `<project>-web` → `{{name}}-web`
- `@<project>/shared` → `@{{name}}/shared`
- `api.<project>.test` → `api.{{name}}.test`

### 2. Handle Dotfiles

Template stores dotfiles without the leading dot (npm strips them during publish):
- `.gitignore` → `gitignore`
- `.prettierrc` → `prettierrc`
- `.npmrc` → `npmrc`
- `.releaserc` → `releaserc`
- `.swcrc` → `swcrc`
- `.env.example` → `env.example`

### 3. Preserve Template Structure

Don't copy project-specific content:
- Don't copy CHANGELOG entries
- Don't copy project-specific README content
- Don't copy environment-specific configs

## Error Handling

| Scenario | Action |
|----------|--------|
| Target path not found | "ERROR: Path does not exist: <path>" |
| Not a valid project | "ERROR: No package.json found at <path>" |
| Compare script fails | Show error message from script |

## Example Usage

```bash
# Compare against Only35
/review-template /Users/carlo/Development/only35

# Compare against another project
/review-template /Users/carlo/Development/rpg
```

## Git Policy

**Do NOT push automatically.** Only commit if user explicitly approves. Let the user push manually after reviewing the changes.
