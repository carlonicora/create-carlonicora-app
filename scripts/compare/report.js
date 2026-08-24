const ORDER = ["DIVERGED", "TARGET_AHEAD", "TARGET_ONLY", "TEMPLATE_ONLY", "NEVER_ADOPT", "ALIGNED"];

const isoDay = (seconds) => (seconds ? new Date(seconds * 1000).toISOString().slice(0, 10) : "—");

/** Make arbitrary text safe inside a markdown table cell. */
const cell = (text, max = 72) => {
  const flat = String(text).replace(/\s+/g, " ").replace(/\|/g, "\\|").replace(/`/g, "'").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

/**
 * Rows are grouped with the ones needing judgement FIRST and ALIGNED last.
 * A report that opens with hundreds of unchanged files buries the handful that
 * actually need a decision, and an unread report is the same as no report.
 */
export function renderMarkdown(rows, meta = {}) {
  const grouped = new Map(ORDER.map((k) => [k, []]));
  for (const row of rows) (grouped.get(row.classification) ?? []).push(row);

  const out = [];
  out.push("# Template drift report");
  out.push("");
  if (meta.generatedAt) out.push(`**Generated:** ${meta.generatedAt}`);
  out.push(`**Targets:** ${(meta.targets ?? []).join(", ") || "—"}`);
  out.push(`**Files compared:** ${rows.length}`);
  out.push("");
  out.push("| Classification | Count |");
  out.push("|---|---|");
  for (const key of ORDER) out.push(`| ${key} | ${grouped.get(key).length} |`);
  out.push("");
  out.push(
    "> `winner` is a ranked HINT, not a decision. A non-bulk commit outranks a newer bulk one, " +
      "because a rename sweep touches a file without advancing it. Judgement is the reader's.",
  );

  for (const key of ORDER) {
    const group = grouped.get(key);
    if (group.length === 0) continue;
    out.push("");
    out.push(`## ${key} (${group.length})`);
    out.push("");
    out.push("| Path | Winner | Targets |");
    out.push("|---|---|---|");
    for (const row of group) {
      const cells = row.targets
        .map((t) => {
          if (!t.present) return `${t.name}: absent`;
          const state = t.equal ? "same" : "differs";
          // The commit SUBJECT is rendered because precedence.md rule 1 tells
          // the reader to judge on it — "the commit subject is what tells them
          // apart, not the timestamp". It was carried on the row and written to
          // the JSON but omitted here, so the document the skill actually routes
          // people to lacked the one field the judgement rule turns on.
          const subject = t.subject ? ` — ${cell(t.subject)}` : "";
          return `${t.name}: ${state}, ${isoDay(t.date)}${t.bulk ? " (bulk)" : ""}${subject}`;
        })
        .join("<br>");
      out.push(`| \`${row.rel.replace(/\|/g, "\\|")}\` | ${row.winner ?? "—"} | ${cells} |`);
    }
  }
  out.push("");
  return out.join("\n");
}

export function renderJson(rows, meta = {}) {
  const counts = Object.fromEntries(ORDER.map((k) => [k, 0]));
  for (const row of rows) if (counts[row.classification] !== undefined) counts[row.classification]++;
  return { meta: { ...meta, total: rows.length, counts }, rows };
}
