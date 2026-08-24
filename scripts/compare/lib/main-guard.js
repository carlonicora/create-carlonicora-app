import fs from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * True when the calling module is the process entry point.
 *
 * Pass `import.meta.url`.
 *
 * The naive form — comparing `import.meta.url` to `"file://" + process.argv[1]`
 * — is wrong in three ordinary situations, and wrong SILENTLY:
 *
 *   - a path containing a space or any non-ASCII character: `import.meta.url`
 *     is percent-encoded (`space%20test`), `process.argv[1]` is not;
 *   - a symlinked entry point: Node resolves the module URL through realpath
 *     while leaving argv[1] exactly as typed;
 *   - a bare `#` or other URL-significant character in a directory name.
 *
 * In each case the module imports fine, the guard evaluates false, and the
 * command exits 0 having done nothing at all — which reads as success. That is
 * the worst failure mode available to a tool whose job is writing files, so it
 * is worth a module of its own rather than a one-liner repeated per entry point.
 */
export function isMain(moduleUrl) {
  if (!process.argv[1]) return false;
  try {
    return moduleUrl === pathToFileURL(fs.realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}
