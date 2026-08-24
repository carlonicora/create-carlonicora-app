import { execFileSync } from "node:child_process";

/**
 * Per-file recency for a whole repo, in ONE git pass.
 *
 * `bulk` is the point of this module. A file's last-commit date says WHEN it
 * was touched, not WHAT advanced. Rename sweeps and dependency chores touch
 * hundreds of files and make every one of them look freshly authored — which
 * is exactly how a project that DELETED a feature can appear to be the one
 * that most recently improved it. A commit touching more than `bulkThreshold`
 * files marks its files `bulk: true`, and consumers demote that recency to a
 * weak hint.
 *
 * Only the FIRST (most recent) commit touching a path is recorded; git log
 * yields commits newest-first.
 */
export function buildGitIndex(repoDir, options = {}) {
  const bulkThreshold = options.bulkThreshold ?? 25;
  const index = new Map();

  const raw = execFileSync(
    "git",
    // core.quotepath=false: without it git octal-escapes any non-ASCII path
    // ("caf\303\251.ts"), so those files never match a real path and end up
    // with NO git entry at all — which pickWinner then has to rank blind.
    ["-c", "core.quotepath=false", "log", "--no-merges", "--format=C|%ct|%s", "--name-only"],
    { cwd: repoDir, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );

  let date = 0;
  let subject = "";
  let pending = [];

  const flush = () => {
    if (pending.length === 0) return;
    const filesInCommit = pending.length;
    const bulk = filesInCommit > bulkThreshold;
    for (const rel of pending) {
      // newest wins: git log is newest-first, so never overwrite.
      if (!index.has(rel)) index.set(rel, { date, subject, filesInCommit, bulk });
    }
    pending = [];
  };

  for (const line of raw.split("\n")) {
    if (line.startsWith("C|")) {
      flush();
      const rest = line.slice(2);
      const sep = rest.indexOf("|");
      date = Number(rest.slice(0, sep));
      subject = rest.slice(sep + 1);
      continue;
    }
    if (line.trim() === "") continue;
    pending.push(line);
  }
  flush();

  return index;
}
