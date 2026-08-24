---
name: template-sync
description: Use when merging drift from the wyrdli or neural-erp checkouts into create-carlonicora-app's template/ — when the template has fallen behind its consuming projects, when a compare/drift report lists TARGET_AHEAD, DIVERGED or TARGET_ONLY rows, when deciding whether a target's version of a file should replace the template's, or before releasing the generator after the template changed.
---

# Template sync — merging wyrdli and neural-erp drift into `template/`

> `template/` is the source of every app this generator scaffolds. It is not owned by any
> one project: `wyrdli` and `neural-erp` advance independently and **neither is a superset**.
> The template is defined by *whichever project most recently advanced a given surface*,
> merged under the explicit rules in `references/precedence.md` — never by blind copying.

## When to invoke this skill

- Refreshing `template/` from `../wyrdli` or `../neural-erp`.
- Reading `template-drift-report.md` / `.json` and deciding what to adopt.
- Any question of the form "which version of this file is right, the template's or the app's?"
- Before publishing the generator when `template/` has changed.

Do **not** invoke it for edits confined to `scripts/`, `src/`, or repo-root config that never
reach a generated app.

## The one thing that must not be forgotten

**Recency is a ranked hint with a confidence flag. It is never the decision.**

`classify.js` emits a `winner` per row. That name means "the strongest hint", not "adopt this".
A file's last-commit date records *when it was touched*, not *what advanced it*. Every winning
commit on a contested file in the 2026-08-23 audit was a bulk or rename commit that touched the
file incidentally. The tool produces evidence; this skill produces judgement; `apply.js` executes
it mechanically. Keep those three separate.

## Routing table (situation → read this first)

| Situation | Read, in this order |
|---|---|
| Starting a sync run at all | this file, top to bottom → `references/precedence.md` |
| A row is `TARGET_AHEAD`, `DIVERGED` or `TARGET_ONLY` | `references/precedence.md` |
| A row touches migrations, app `config.ts`, `shared/src/index.ts`, or a `ModuleId` const | `references/never-adopt.md` |
| A row is `NEVER_ADOPT` or you are tempted to add/remove a `neverAdopt` entry | `references/never-adopt.md` |
| A row is `TEMPLATE_ONLY` | `references/never-adopt.md` (the `templateOnly` list section) |
| `pnpm check:template` failed, or a check looks like a false positive | `references/integrity.md` |
| Adding, editing or silencing an integrity check | `references/integrity.md` |
| Any adoption has landed and you are about to call the work done | `references/verification.md` |
| Stopping or restarting a dev server during verification | `references/verification.md`, step 8 — **read it before killing anything** |

## Workflow

`preflight → compare → triage → judge → apply → integrity → verify → report`

Do not skip a stage. Do not reorder them. `integrity` before `verify` is deliberate: a cheap
gate should fail before an expensive one runs.

### 1. preflight

- Confirm every target in `template.sources.json` exists on disk (`../wyrdli`, `../neural-erp`)
  and is on its default branch with a clean-enough tree that its `git log` means something.
- Run `pnpm check:template` and confirm it is **green before you change anything**. A failure
  discovered after adoption is unattributable — you will not know whether you caused it.
- **Read-only against targets.** Never write into `../wyrdli`, `../neural-erp`, or any other
  configured target, for any reason, including "just to test".

### 2. compare

```bash
pnpm compare:template
```

Writes `template-drift-report.md` (for reading) and `template-drift-report.json` (for working).
The markdown groups rows judgement-first and `ALIGNED` last, on purpose: a report that opens
with hundreds of unchanged files is an unread report.

### 3. triage

**Shrink the list before judging anything.** A run produces ~400 rows; fewer than a
quarter deserve a human decision. Judging the raw report is how a sync run turns into
an afternoon.

Strip, in this order:

1. `ALIGNED`, `NEVER_ADOPT`, `TEMPLATE_ONLY` — no action by definition (~200 rows).
2. Rows outside `apps/` — `CLAUDE.md`, `README.md`, `AGENTS.md`, `Dockerfile`,
   `tsconfig*`, `turbo.json`, `.github/**`, `docs/**`. These differ from every project
   **by design and permanently**. A row here is not drift.

```bash
node -e "const j=require('./template-drift-report.json');
const rows=j.rows.filter(r=>['DIVERGED','TARGET_AHEAD','TARGET_ONLY'].includes(r.classification))
 .filter(r=>r.rel.startsWith('apps/')||r.rel.startsWith('packages/'));
console.log(rows.length+' rows need judgement');
rows.forEach(r=>console.log(r.classification.padEnd(13),(r.winner??'-').padEnd(11),r.rel))"
```

What remains is the real queue. Judge that.

| Classification | Action |
|---|---|
| `ALIGNED` | Nothing. Do not open the file. |
| `NEVER_ADOPT` | Skip **without reading the diff**. Reading it is how you talk yourself into it. If you believe an entry is wrong, see `references/never-adopt.md` — changing the list is a separate, argued decision, not a mid-run improvisation. |
| `TEMPLATE_ONLY` | Confirm the path is intentional against the `templateOnly` list in `template.sources.json`. If it is *not* listed, it is a file only the template has and nobody declared — investigate before assuming it is fine. |
| `TARGET_AHEAD` | Judge. One target differs; every other present target matches the template. |
| `DIVERGED` | Judge. Two or more targets disagree with the template *and* with each other. Highest scrutiny. |
| `TARGET_ONLY` | Judge. A candidate addition the template does not have. Ask first whether the template *should* have it, not whether the target's version is good. |

### 4. judge

**One row at a time, against `references/precedence.md`.** For each row record, before moving on:
the path, the decision (adopt / reject / adopt-with-edits), which target, and the rule from
`precedence.md` that produced the decision. A decision without a cited rule is a guess, and it
is the thing that drifts between sessions.

When two rules point opposite ways, the tie-break is the last rule in `precedence.md`: **keep the
template.**

### 5. apply

```bash
pnpm template:apply --target <name> --paths <comma-separated list>
```

Add `--dry-run` to see exactly which paths would be written, and which the target does not
have, before anything touches `template/`. The command exits non-zero if any path was skipped,
so a typo in a path cannot pass as a successful adoption.

`apply.js` is deliberately dumb — it copies exactly the paths it is handed and re-runs
`generalize()` on each. It decides nothing. There is no path back to whole-tree copying, and you
must not build one (no "just this once" loop over the whole `TARGET_AHEAD` group).

After applying, sweep every adopted file for brand strings and placeholder consistency —
see the re-generalization rule in `references/precedence.md`.

### 6. integrity

```bash
pnpm check:template --strict
pnpm test
```

`--strict` turns a `SKIP` into a failure, so a missing library checkout cannot silently hide the
checks that need it. Read `references/integrity.md` before deciding any failure is a false
positive.

### 7. verify

`references/verification.md`, all eight steps. Lint, build and test all pass on a NestJS graph
that cannot start; only booting proves it. Step 8 governs how processes are stopped and is a
hard prohibition, not advice.

### 8. report

**The human never reads `template-drift-report.md`.** It is 400+ rows of evidence for
you, not a deliverable for them. Handing it over — or a per-row narration of it — is a
failure of this stage.

Produce a SHORT ranked proposal and stop. Target 20 lines, hard ceiling 40:

```
Reviewed N rows (M after triage). Proposing:

ADOPT (k)
  <path>            from <target>   — <one clause: what it fixes or adds>
KEEP TEMPLATE (k)
  <path>            — <one clause: why the template's version is right>
NEEDS YOUR CALL (k)
  <path>            — <the actual question, in one sentence>

Nothing adopted yet. Say which groups to apply.
```

Rules for it:

- Group by decision, never by classification. The user does not care that a row was
  `TARGET_AHEAD`; they care whether it lands.
- One clause per row. If a row needs a paragraph it belongs in NEEDS YOUR CALL.
- Collapse repetition: "12 email templates from wyrdli — whitespace only" is one line,
  not twelve.
- NEEDS YOUR CALL is for genuine product decisions, not for anything you were merely
  unsure about. Decide what you can decide.
- **Adopt nothing before they answer.** Then apply, run `integrity` and `verify`, and
  report only what changed and what the gates said.

## Red flags — stop and re-read `references/precedence.md`

- "The report picked a winner, so I'll adopt it."
- "It's newer, so it's better."
- "I'll adopt the whole `TARGET_AHEAD` group and check afterwards."
- "The target deleted its test step, so the template probably should too."
- "I'll just peek at the `NEVER_ADOPT` diff."
- "This check is annoying, I'll add an exclusion."
- "The dev server is still up, I'll `pkill -f` it."
- "Typecheck and tests pass, that's good enough — skipping the boot."

Every one of these has a documented counter-case in the references. None of them is a judgement.

## Reference index

| File | Contents |
|---|---|
| `references/precedence.md` | The judgement rules, each with the measured case that produced it, plus the recency/bulk-commit evidence |
| `references/never-adopt.md` | Paths that are structurally not drift, with the evidence for each; how `neverAdopt`, `templateOnly` and per-target `ignore` differ |
| `references/integrity.md` | The nine integrity checks: what each catches, how to read its failure, where its guarantee stops |
| `references/verification.md` | The scaffold-install-boot gate, and the process-kill prohibition |
