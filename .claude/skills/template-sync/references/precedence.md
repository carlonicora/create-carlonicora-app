# Precedence — which version wins, and why

Every rule below carries the case that produced it. The rationale is not decoration: a rules
file without its evidence gets overridden by the next session's convenience. If you are about
to break a rule, you owe the same class of evidence that put it here.

Rules are ordered. When two point opposite ways, the later one does not automatically win —
read both, then fall through to the tie-break at the bottom.

---

## 1. Recency is a hint, never a decision

A file's last-commit date records **when it was touched**, not **what advanced it**.

`classify.js` ranks candidates and names a `winner`. The report itself says so:

> `winner` is a ranked HINT, not a decision. A non-bulk commit outranks a newer bulk one,
> because a rename sweep touches a file without advancing it. Judgement is the reader's.

Evidence — per-file `git log -1` on the contested files from the 2026-08-23 audit:

| file | wyrdli | neural-erp | verdict |
|---|---|---|---|
| `SettingsContainer.tsx` | 08-19 `feat: rename narr8 → Wyrdli` | 08-22 `chore: update pnpm workspace…` | picks neural-erp — correct |
| `utils/metadata.ts` | 08-19 `feat(marketing)` | 02-23 `fix: rename` | picks wyrdli — correct |
| `neo4j.migrations/20250901_002.ts` | 2025-12-15 | 2026-03-18 | picks neural-erp — correct, but the row is `NEVER_ADOPT` regardless |
| `.github/workflows/dev.yml` | 08-22 `ci: bump actions` | 08-22 `chore: pnpm workspace…` | tie — **and wyrdli's file has no `pnpm test`** |

The dates land on the right answer in some rows and the wrong one in others, and **the commit
subject is what tells them apart** — not the timestamp. Read the subject on every row you judge.

## 2. Bulk commits are not evidence

A commit touching more than 25 files is a rename or chore sweep. `buildGitIndex` sets a `bulk`
flag on every file in such a commit, and `pickWinner` ranks **non-bulk above bulk before it looks
at the date at all**. Where every candidate is bulk, the newest wins but every target still
carries `bulk: true` in the row so the reader can see the hint is weak.

Measured case, re-verified against the live report on 2026-08-24 — `.github/workflows/dev.yml`
classifies `TARGET_AHEAD` with **wyrdli** as winner:

| target | equals template | bulk | date | subject |
|---|---|---|---|---|
| wyrdli | no | **no** | 2026-08-22 | `ci: bump workflow actions to Node 24 runtimes` |
| neural-erp | yes | yes | 2026-08-22 | `chore: update pnpm workspace configuration…` |

wyrdli wins the ranking honestly: its commit is the only non-bulk one. And wyrdli's `dev.yml`
contains **no `pnpm test` step at all**, while the template's and neural-erp's both do (verified
by grep on all three files). So the mechanical winner here is the version that **deleted the test
gate** — and nothing in the ranking can know that.

This is the sharpest illustration in the whole tool: a clean, non-bulk, genuinely-more-recent
commit can still be the wrong thing to adopt. Rule 3 below is what saves you, not the ranking.

When a row shows `(bulk)` on the winner, treat the recency signal as absent and judge on content.
When it shows no `(bulk)` at all, you still have to read the diff.

## 3. The template keeps CI test steps and pre-push hooks even when a target deletes them

A target removing its own test gate is a project decision, made by people who can see their own
CI bill and their own flake rate. A **scaffolder** shipping without one is a defect that
propagates into every app it ever creates.

Evidence: of the 49 files where `template == neural-erp` but `template != wyrdli`, per-file
judgement found the template ahead in roughly 40 — largely because it keeps CI `pnpm test`
steps and the `pre-push` hook that wyrdli deleted, plus the `^_` unused-args ESLint rule.

That 49 is the hand-audit's figure from 2026-08-23. The tool reports 45 for the same set on
2026-08-24, because Plan A has since repaired several template files and the tool's `ignore`
lists exclude paths the hand-audit counted. Expect the count to drift; the conclusion does not.

The same reasoning covers any other quality gate: lint config, type-check steps, hooks. A target
may opt out; the template may not.

## 4. Prefer i18n'd strings over hardcoded ones

Measured case: the template's `VersionDisplay` uses `t("common.version_display")` while wyrdli
hardcodes its product name. Adopting wyrdli's version would bake one project's brand into every
generated app, and would do it in a place a brand sweep does not reach because the string is
grammatical English rather than a recognisable app name.

A hardcoded string in a target is usually the *target* regressing, not the template lagging.

## 5. Prefer library containers over hand-rolled equivalents

If `@carlonicora/nextjs-jsonapi` or `@carlonicora/nestjs-neo4jsonapi` ships a container and a
target has a local reimplementation of it, the library version wins. The template's job is to
demonstrate the framework, and a hand-rolled copy stops tracking the library the day it is
copied.

Corollary, and the reason this rule has teeth: the template once imported
`ProductsAdminContainer` from `@carlonicora/nextjs-jsonapi/billing`, a symbol that existed in
neither `dist` nor `src`. **The template did not typecheck against the library it declares.**
Preferring the library container only helps if you also verify the symbol exists — see step 5 of
`verification.md`.

## 6. Prefer server-safe subpath imports in anything reachable from `instrumentation.ts`

Measured case: importing `tokenUsageModules` from `/core` rather than the server-safe
`/tokenusage` subpath **crashed every generated app's dev server** — and it resolved, typechecked
and passed its own check first. Nothing short of booting the app caught it.

So: in any module on a path reachable from `instrumentation.ts`, `Bootstrapper.ts`, a Server
Component, or a route handler, use the narrowest documented subpath rather than the barrel.
A barrel import that typechecks is not evidence of anything.

## 7. Every adopted file is re-generalized and brand-swept

`apply.js` re-runs `generalize()` on every text file it copies. That is necessary and not
sufficient. After applying, sweep the adopted files yourself for:

- literal `wyrdli` / `neural-erp` / product-name strings that survived generalization,
- brand colours and logo assets lifted with the file (the audit's email templates carried
  `#167b5d` and a logo `img`),
- **placeholder consistency**: `{{name}}` is kebab-case and machine-facing; `{{display}}` is
  human-readable. Mixing them inside one rendered file is visible to the end user of the
  generated app.
- unsubstituted placeholders in positions that are parsed rather than printed — most sharply,
  a schemeless `{{name}}.com` inside a one-argument `new URL()`, which scaffolds to
  `new URL("myapp.com")` → `TypeError: Invalid URL`, and `generateSpecificMetadata` backs nearly
  every `generateMetadata`, so with `APP_URL` unset **every page 500s**. The `placeholder-urls`
  check exists for exactly this; do not rely on it alone for a file you just adopted.

## 8. When a target and the template disagree and both look defensible, keep the template

The template serves projects that do not exist yet. A target's version is tuned to that target's
present needs, and its author had context you do not. Absent a rule above that decides the row,
"defensible either way" resolves to **no change**.

This is also the tie-break when rules 3–7 conflict.

---

## Judging by classification

**`TARGET_AHEAD`** — one target differs, the others match the template. The cheapest rows, and
the ones where recency-thinking does the most damage. Read the commit subject first: `feat:` or
a scoped `fix:` on that file is real; `chore:`, `ci:`, `refactor: rename`, or anything flagged
`(bulk)` is not.

**`DIVERGED`** — two or more targets disagree with the template and with each other. Nothing is
inherited here; judge all three versions on content against rules 3–7. If no rule decides it,
rule 8 does.

**`TARGET_ONLY`** — a candidate addition. Ask **"should the template have this at all?"** before
"is this version good?" A file that exists only in one target is usually that target's domain
leaking through a gap in its `ignore` list — the fix is an `ignore` entry, not an adoption.
Adopt only framework surface every generated app needs (routes, config, chrome), never business
code.

**`TEMPLATE_ONLY`** — confirm against the `templateOnly` list. Listed means intentional. Not
listed means an undeclared template-only file: decide whether to declare it or to remove it,
and say which in the report.

---

## Recording a decision

For every judged row, record: path, decision, target, and **the number of the rule above that
produced it**. A decision with no rule cited is a guess, and it is the thing that drifts between
sessions — which is why these rules live in this file and not in a session's head.
