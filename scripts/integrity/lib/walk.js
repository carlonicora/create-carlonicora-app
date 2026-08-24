import fs from "fs";
import path from "path";

const ALWAYS_SKIP = new Set(["node_modules", ".git", "dist", ".next", ".turbo", "coverage"]);

/** Recursively list files under `dir`. Directory names in ALWAYS_SKIP are never descended. */
export function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ALWAYS_SKIP.has(entry.name)) continue;
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}
