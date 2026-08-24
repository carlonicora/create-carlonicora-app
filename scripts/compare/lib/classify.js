export const CLASSIFICATIONS = [
  "ALIGNED",
  "TARGET_AHEAD",
  "DIVERGED",
  "TARGET_ONLY",
  "TEMPLATE_ONLY",
  "NEVER_ADOPT",
];

/**
 * Classify one path across N targets.
 *
 * The `winner` is a RANKED HINT, never a decision. Recency is confounded by
 * bulk commits, so a non-bulk target always outranks a bulk one even when the
 * bulk one is newer — that single rule is what stops a rename sweep from
 * looking like the most recent improvement. Where every candidate is bulk, the
 * newest wins but the row still carries `bulk: true` for every target so a
 * reader can see the hint is weak.
 *
 * A row is only ever a hint plus evidence. Nothing here adopts anything.
 */
export function classifyRow(input) {
  const { rel, inTemplate, templateBody, targets, neverAdopt = [], templateOnly = [] } = input;

  const summarised = targets.map((t) => ({
    name: t.name,
    present: t.present,
    equal: t.present && inTemplate ? t.body === templateBody : false,
    date: t.git?.date ?? null,
    subject: t.git?.subject ?? null,
    bulk: t.git?.bulk ?? false,
  }));

  const matches = (patterns) => patterns.some((p) => rel === p || rel.startsWith(`${p}/`));

  const row = { rel, classification: null, winner: null, targets: summarised };

  if (matches(neverAdopt)) {
    row.classification = "NEVER_ADOPT";
    return row;
  }

  // templateOnly is checked BEFORE the !inTemplate branch. When it came after,
  // a declared templateOnly subtree that the template did not yet contain but a
  // target did fell through to TARGET_ONLY — so the declaration "this subtree is
  // the template's own" was silently overridden for exactly the file most likely
  // to be adopted (observed on apps/web/src/features/pwa).
  if (matches(templateOnly)) {
    row.classification = "TEMPLATE_ONLY";
    return row;
  }

  const present = summarised.filter((t) => t.present);

  if (!inTemplate) {
    row.classification = "TARGET_ONLY";
    row.winner = pickWinner(present);
    return row;
  }

  if (present.length === 0) {
    row.classification = "TEMPLATE_ONLY";
    return row;
  }

  if (present.every((t) => t.equal)) {
    row.classification = "ALIGNED";
    return row;
  }

  const differing = present.filter((t) => !t.equal);
  // One target differs while every other present target matches the template:
  // a single candidate to consider. More than one differing version means the
  // three-way disagreement a human has to resolve.
  row.classification = differing.length === 1 ? "TARGET_AHEAD" : "DIVERGED";
  row.winner = pickWinner(differing);
  return row;
}

/**
 * Unknown history ranks LAST; then non-bulk beats bulk; then newest wins.
 *
 * The unknown-history rule matters because `bulk` defaults to false when there
 * is no git entry at all. Without this first comparator, "we know nothing about
 * this file" landed on the WINNING side of the very comparator that exists to
 * discount weak evidence, so a file with no history outranked a real dated
 * commit. No evidence is the weakest evidence, not the strongest.
 */
function pickWinner(candidates) {
  const ranked = [...candidates].sort((a, b) => {
    const aUnknown = a.date === null || a.date === undefined;
    const bUnknown = b.date === null || b.date === undefined;
    if (aUnknown !== bUnknown) return aUnknown ? 1 : -1;
    if (a.bulk !== b.bulk) return a.bulk ? 1 : -1;
    return (b.date ?? 0) - (a.date ?? 0);
  });
  return ranked[0]?.name ?? null;
}
