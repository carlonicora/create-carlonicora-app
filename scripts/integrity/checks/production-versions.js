import fs from "fs";
import path from "path";
import { resolveLibraryPaths } from "../lib/config.js";

export default {
  id: "production-versions",
  title: "versions.production.json matches the libraries on disk",
  run(ctx) {
    const libs = resolveLibraryPaths(ctx);
    const pinnedPath = path.join(ctx.templateDir, "versions.production.json");
    const pinned = JSON.parse(fs.readFileSync(pinnedPath, "utf8"));
    const failures = [];

    for (const [name, dir] of Object.entries(libs)) {
      const actual = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version;
      if (pinned[name] !== actual)
        failures.push(`versions.production.json pins ${name}@${pinned[name]}, library on disk is ${actual}`);
    }
    return failures;
  },
};
