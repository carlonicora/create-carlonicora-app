---
allowed-tools: Bash, Read, Edit, Write, Glob, AskUserQuestion, Task, TaskOutput
argument-hint: '<target-project-path>'
description: Generate a checklist of template differences for selective review
---

# Template Checklist

Generate an interactive checklist of template differences, allowing selective file review.

## Purpose

This command provides a two-phase workflow for reviewing template differences:

1. **Selection Phase**: Generate a checklist where you mark which files to analyze
2. **Review Phase**: Analyze only the selected files with the same detail as `/review-template`

This is useful when you want to focus on specific changes rather than reviewing all differences.

## Instructions

### Step 1: Validate Arguments

```bash
# Check target path provided
if [ -z "$ARGUMENTS" ]; then
  echo "ERROR: Target project path required"
  echo "Usage: /template-checklist /path/to/project"
  exit 1
fi

# Check target exists
ls -la $ARGUMENTS/package.json
```

If no argument provided, use AskUserQuestion to ask for the path.

### Step 2: Generate Both Reports

Run the compare-template script twice to generate:

1. **Checklist file** - for user to select files (checkboxes only, no content)
2. **Full report** - for LLM to analyze selected files (contains diffs and content)

```bash
# Generate checklist for user selection
pnpm compare-template $ARGUMENTS --checklist --output /Users/carlo/Development/create-carlonicora-app/template-checklist.md

# Generate full report for LLM analysis
pnpm compare-template $ARGUMENTS --output /tmp/template-comparison.md
```

### Step 3: Notify User

Display a message telling the user (the checklist file path will be shown in the script output):

```
===============================================================
CHECKLIST GENERATED
===============================================================

File created: /Users/carlo/Development/create-carlonicora-app/template-checklist.md

Please open this file and mark the files you want to analyze:
- Change [ ] to [x] for files you want to review

The file is organized by category:
- Config Drift: Configuration files that differ
- Version Drift: Package.json version-only changes
- Custom Code: Source code differences
- Additions: Files only in target project
- Missing from Target: Files only in template

When you're done marking files, come back here and confirm.
===============================================================
```

### Step 4: Wait for User Confirmation

Use AskUserQuestion:

```
question: "Have you finished marking the files you want to analyze?"
header: "Ready?"
options:
  - label: "Yes, continue"
    description: "I've marked the files, proceed with analysis"
  - label: "Cancel"
    description: "Abort the review process"
```

If "Cancel" selected, display "Review cancelled." and stop.

### Step 5: Parse Selected Files

Read the checklist file and extract all checked files:

```bash
cat /Users/carlo/Development/create-carlonicora-app/template-checklist.md
```

Parse the file to find all lines matching the pattern:

- `- [x]` followed by a file path in backticks

Extract the file paths into a list for processing.

Also determine each file's category based on which section it appears in.

If no files are checked, display:

```
No files were selected for review. Exiting.
```

### Step 6: Review Each Selected File

For each checked file:

1. Look up the file in the **full report** (`/tmp/template-comparison.md`) to get the diff summary
2. Follow the same process as `/review-template`:

**CRITICAL RULE: Never ask a question without showing full context first.**

1. **Display the file being reviewed:**

   ```
   ═══════════════════════════════════════════════════════════════
   REVIEWING: <file-path>
   Category: <category>
   ═══════════════════════════════════════════════════════════════
   ```

2. **Handle based on category:**

   **For Config Drift, Version Drift, Custom Code:**

   Read and display BOTH versions:

   ```bash
   # Template version (handle dotfile renaming)
   cat /Users/carlo/Development/create-carlonicora-app/template/<path>
   ```

   ```bash
   # Target version
   cat $ARGUMENTS/<path>
   ```

   Show a clear diff summary.

   **For Additions (files only in target):**

   Read and display the target file:

   ```bash
   cat $ARGUMENTS/<path>
   ```

   Note: "This file exists only in the target project, not in template."

   **For Missing from Target:**

   Read and display the template file:

   ```bash
   cat /Users/carlo/Development/create-carlonicora-app/template/<path>
   ```

   Note: "This file exists only in the template, not in target project."

3. **ONLY AFTER showing all context**, use AskUserQuestion:

   **For Config Drift, Version Drift, Custom Code:**

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

   **For Additions:**

   ```
   question: "Should this file be added to the template?"
   header: "<filename>"
   options:
     - label: "Add to template"
       description: "Copy this file to the template"
     - label: "Skip"
       description: "This is project-specific, don't add to template"
   ```

   **For Missing from Target:**

   ```
   question: "What should we do about this missing file?"
   header: "<filename>"
   options:
     - label: "Keep in template"
       description: "File should remain in template"
     - label: "Remove from template"
       description: "Delete this file from the template"
     - label: "Skip"
       description: "Decide later"
   ```

4. **Apply the action using background agents:**

   **IMPORTANT:** For update/add/remove actions, spawn a background agent so the main thread can immediately ask about the next file.

   If "Update template" or "Add to template" selected:
   - Use the **Task tool** with `run_in_background: true` and `subagent_type: "general-purpose"`
   - Provide this prompt to the agent:
     ```
     Update template file: <file-path>
     Project name: <project-name> (from the checklist header)

     Instructions:
     1. Read the file from: <target-path>/<file-path>
     2. Replace all occurrences of "<project-name>" with "{{name}}"
     3. Replace "<project-name>-api" with "{{name}}-api"
     4. Replace "<project-name>-web" with "{{name}}-web"
     5. Replace "@<project-name>/shared" with "@{{name}}/shared"
     6. If file path starts with ".", remove the dot for the template path
        (e.g., .gitignore → gitignore, .gitattributes → gitattributes)
     7. Write the result to: /Users/carlo/Development/create-carlonicora-app/template/<template-path>
     8. Report success with the file path, or report failure with the error
     ```
   - **Track the agent's task_id** in a list for later (e.g., `backgroundAgents.push({ file, taskId, action: "update" })`)
   - **Immediately continue to the next file** without waiting

   If "Remove from template" selected:
   - Spawn a background agent to delete the file from the template directory
   - Track the task_id
   - Immediately continue to the next file

   If "Keep template" or "Skip" selected:
   - No background agent needed
   - Track the decision
   - Immediately continue to the next file

### Step 7: Wait for Background Agents

After all files have been reviewed and questions answered, wait for any background agents to complete:

1. **Check if there are any background agents** that were spawned during Step 6
2. **For each background agent**, use the **TaskOutput tool** with `block: true` to wait for completion:
   ```
   TaskOutput(task_id=<agent-task-id>, block=true, timeout=60000)
   ```
3. **Collect results** from each agent:
   - If successful: add to success count
   - If failed: add to failures list with the file path and error message

This ensures all template updates are complete before showing the summary.

### Step 8: Summary Report

After all background agents have completed, display:

```
===============================================================
TEMPLATE CHECKLIST REVIEW COMPLETE
===============================================================

Selected: <N> files
Reviewed: <N> files
Updated template: <N> files (successful)
Added to template: <N> files (successful)
Removed from template: <N> files
Kept template: <N> files
Skipped: <N> files
Failed: <N> files

Files Updated:
- <list of files successfully updated/added/removed in template>

[If any failures occurred:]
Failed Updates:
- <file-path>: <error message>
- ...

Next Steps:
1. Review changes: git diff template/
2. Test scaffolding: pnpm build && npx . test-project
3. Commit: git add template/ && git commit -m "chore: sync template with <project>"

===============================================================
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

| Scenario                 | Action                                                           |
| ------------------------ | ---------------------------------------------------------------- |
| Target path not found    | "ERROR: Path does not exist: <path>"                             |
| Not a valid project      | "ERROR: No package.json found at <path>"                         |
| Compare script fails     | Show error message from script                                   |
| No files selected        | "No files were selected for review. Exiting."                    |
| Checklist file not found | "ERROR: Checklist file not found. Please run the command again." |

## Example Usage

```bash
# Compare against Only35
/template-checklist /Users/carlo/Development/only35

# Compare against another project
/template-checklist /Users/carlo/Development/rpg
```

## Git Policy

**Do NOT push automatically.** Only commit if user explicitly approves. Let the user push manually after reviewing the changes.
