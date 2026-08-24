# Never adopt — paths that are not drift

Every path here differs between the template and a target **for a structural reason**. The
difference is not the template lagging; it is the two files meaning different things. A diff
that looks adoptable is exactly the trap, which is why the workflow says to skip `NEVER_ADOPT`
rows **without reading the diff**.

## The three lists, and which one to reach for

`template.sources.json` holds three lists that are easy to confuse:

| List | Scope | Effect |
|---|---|---|
| per-target `ignore` | one target | The path never enters the census at all. Use for **that project's business code** — its own features, domain packages, product docs. |
| `neverAdopt` | repo-wide | The path is compared and reported, classified `NEVER_ADOPT`, and never adopted. Use when the file **exists in both** and the difference is structural. |
| `templateOnly` | repo-wide | Declares that a template path is intentionally absent from targets, so `TEMPLATE_ONLY` reads as expected rather than as a gap. |

**Matching is literal, not glob.** `classify.js` matches a row with
`rel === pattern || rel.startsWith(pattern + "/")`. A `*` in a pattern matches nothing. Write the
directory prefix (`apps/api/src/neo4j.migrations`) or the exact file path, and if a target spells
a filename differently, list **both spellings** or cover it in that target's `ignore`.

Live example of that hazard: the template has `packages/shared/src/const/module.id.ts`; wyrdli
has `packages/shared/src/const/modules.id.ts` (plural). `neverAdopt` lists only the template's
spelling. It is safe today only because wyrdli's `ignore` names its file and neural-erp's
`ignore` covers `packages/shared/src/const` wholesale. Add a target that does neither and the
protection is gone.

---

## The entries, and the evidence for each

### `apps/api/src/neo4j.migrations/**`

wyrdli and the template use **different bootstrap schemes**. wyrdli's `20250901_002.ts` seeds
*features*; the template's seeds *modules*. Same file path, same migration id, incompatible
intent. This is not drift and there is no merged version of it.

Recency actively misleads here: neural-erp's copy is dated 2026-03-18 against wyrdli's
2025-12-15, so the winner hint names neural-erp — a correct-looking answer to a question that
should not be asked.

Adopting any of these ships a migration that seeds the wrong node set into every generated app,
and migrations are the one thing a generated app cannot easily walk back.

### `apps/api/src/config/config.ts` and `apps/api/src/config/interfaces/config.interface.ts`

Every app **extends** these with its own fields — wyrdli adds prompt, audio and responder-tuning
config; neural-erp adds its own. The template's near-empty extension is not a stub to be filled;
it is the correct base for an app that has no app-specific config yet.

Adopting a target's version ships that target's config surface — and its required env keys —
into apps that will never set them.

### `packages/shared/src/index.ts`

A barrel that exports **its own app's domain**. wyrdli's exports calendar and game-system
modules; neural-erp's exports money, pricing, invoice, schemas. Neither has anything to do with
what a fresh app should export. Listed in `neverAdopt` *and* in both targets' `ignore` — belt and
braces, because a barrel is the single highest-blast-radius file in `packages/shared`.

### `packages/shared/src/const/module*.id.ts`

**The same exported symbol with different meanings.** wyrdli's `ModuleId` holds campaign-entity
UUIDs used for assistant visibility. The template's holds RBAC module UUIDs that migration 002
seeds into the database.

Adopting wyrdli's would compile cleanly, typecheck cleanly, pass every static check — and leave
a generated app whose RBAC lookups reference UUIDs that no migration ever seeded. There is no
signal in the diff that says so; the only signal is this paragraph.

See the spelling hazard above: `module.id.ts` in the template, `modules.id.ts` in wyrdli.

### `package.json` and `pnpm-lock.yaml`

Dependency sets are project decisions. A target's `package.json` carries its own dependencies,
its own scripts and its own version; a lockfile carries the full resolved graph of those.
Adopting either replaces the template's dependency contract with an app's.

Related, and separately enforced: the `manifests` check requires that only the template's **root**
manifest pins `packageManager`, and that every `scripts/…` path a manifest names exists on disk.
Adopting a target's `apps/web/package.json` reintroduces exactly the nested `packageManager` pin
that check was written against.

---

## Adding or removing an entry

Do **not** edit `neverAdopt` mid-run to unblock a row. It is a separate, argued decision, and
mixing it into a merge run is how a structural rule becomes a one-off exception.

To add an entry, you need what every entry above has: a statement of *why the two files mean
different things*, not merely that they differ. "It keeps showing up in the report" is not a
reason — that is what `ignore` is for.

To remove one, you need evidence that the structural difference is gone: the bootstrap schemes
converged, the symbol means the same thing in both places. Then say so in the report, so the
next session can see the rule was retired deliberately rather than forgotten.
