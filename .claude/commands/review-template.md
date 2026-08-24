---
allowed-tools: Bash, Read, Edit, Write, Glob, Skill, AskUserQuestion
description: Compare the template against every configured source project and review the drift
---

# Review Template

Invoke the **`template-sync` skill** and follow it end to end.

```
Skill(skill: "template-sync")
```

That skill owns this workflow now: `preflight → compare → triage → judge → apply → integrity → verify → report`.

## What changed

This command used to run `pnpm compare-template <path> --output …` — a single-target
comparison that took the project path as an argument. It has been retired, along with
`scripts/sync-template.js` and `src/compare/`.

The replacement is multi-target and config-driven:

```bash
pnpm compare:template     # reads template.sources.json, writes template-drift-report.{md,json}
```

Targets, `neverAdopt` and `templateOnly` live in `template.sources.json` at the repo
root — add a project there rather than passing a path here.

## Why the skill, not this file

The hard part was never running the comparison; it is deciding what to adopt. That
judgement — recency is only a hint, bulk commits are not evidence, the template keeps
CI gates a target dropped — lives in `.claude/skills/template-sync/references/`, with
the measured case behind each rule. A workflow duplicated here would drift out of step
with it.
