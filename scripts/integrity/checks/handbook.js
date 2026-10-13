import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

/**
 * Runs the template's own handbook checker against template/. A template edit
 * that moves a file a handbook page cites fails here, in this repo, before it
 * can ship inside a scaffolded app.
 *
 * The checker resolves its repo root as its own `..`, so running it with cwd
 * set to templateDir checks template/docs/handbook against template/.
 */
export default {
  id: "handbook",
  title: "docs/handbook cites only paths that exist in template/",
  run({ templateDir }) {
    const checker = path.join(templateDir, "scripts/check-handbook.mjs");
    if (!fs.existsSync(path.join(templateDir, "docs/handbook"))) {
      const error = new Error("template/docs/handbook is not present");
      error.code = "SKIP";
      throw error;
    }
    if (!fs.existsSync(checker)) {
      return ["template/scripts/check-handbook.mjs is missing — the handbook has no checker."];
    }

    const result = spawnSync(process.execPath, ["scripts/check-handbook.mjs"], {
      cwd: templateDir,
      encoding: "utf8",
    });

    if (result.error) return [`could not run scripts/check-handbook.mjs: ${result.error.message}`];
    if (result.status === 0) return [];

    const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
    const lines = output ? output.split("\n").filter((l) => l.trim()) : [];
    return lines.length ? lines : [`scripts/check-handbook.mjs exited with code ${result.status}`];
  },
};
