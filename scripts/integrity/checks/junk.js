import path from "path";
import { walk } from "../lib/walk.js";
import { requireDir } from "../lib/require-dir.js";

const JUNK = [/(^|\/)\.DS_Store$/, /\.log$/, /(^|\/)Thumbs\.db$/];

export default {
  id: "junk",
  title: "template/ contains no OS or build junk",
  run({ templateDir }) {
    const missing = requireDir(templateDir, templateDir, "the template root");
    if (missing.length) return missing;

    return walk(templateDir)
      .map((f) => path.relative(templateDir, f))
      .filter((rel) => JUNK.some((re) => re.test(rel)))
      .map((rel) => `junk file shipped in template: ${rel}`);
  },
};
