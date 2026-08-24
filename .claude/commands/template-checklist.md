---
allowed-tools: Bash, Read, Edit, Write, Glob, Skill, AskUserQuestion, Task, TaskOutput
description: Generate the template drift report and triage it into a decision list
---

# Template Checklist

Invoke the **`template-sync` skill** and follow its `compare` and `triage` stages.

```
Skill(skill: "template-sync")
```

## What changed

This command used to run `pnpm compare-template <path> --checklist --output …` twice —
once for a human-selectable checklist, once for a full report. Both the script and its
`--checklist` / `--output` flags have been retired.

One command now produces both artifacts:

```bash
pnpm compare:template
```

- `template-drift-report.md` — grouped for reading, judgement-needed classifications
  first and `ALIGNED` last, each row carrying every target's date, `(bulk)` flag and
  commit subject.
- `template-drift-report.json` — the same rows for programmatic triage.

Rows are pre-classified `DIVERGED` · `TARGET_AHEAD` · `TARGET_ONLY` · `TEMPLATE_ONLY` ·
`NEVER_ADOPT` · `ALIGNED`, which is the checklist this command used to build by hand.
The skill's triage table says what to do with each group.

Adopt a reviewed subset with:

```bash
pnpm template:apply --target <name> --paths <comma-separated list> [--dry-run]
```
