import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

/**
 * Extensions we never attempt to read as text. Shared by the comparison walk
 * and the apply step ON PURPOSE: when the two disagreed, apply re-encoded as
 * UTF-8 whatever compare had skipped, turning a 9-byte .onnx into 15 bytes of
 * replacement characters and reporting it as successfully applied.
 */
export const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg", ".woff", ".woff2",
  ".ttf", ".eot", ".otf", ".pdf", ".zip", ".gz", ".lock", ".onnx", ".mp3",
  ".mp4", ".wav", ".avif", ".bmp", ".tar", ".jar", ".wasm", ".node",
]);

/**
 * Extension lists always lag reality, so also sniff: a NUL byte in the first
 * 8 KB means binary regardless of what the file is called. Without this, an
 * unlisted extension silently takes the text path.
 */
export function isBinaryFile(file) {
  if (BINARY_EXTENSIONS.has(path.extname(file).toLowerCase())) return true;
  let fd;
  try {
    fd = fs.openSync(file, "r");
    const buffer = Buffer.alloc(8192);
    const read = fs.readSync(fd, buffer, 0, 8192, 0);
    return buffer.subarray(0, read).includes(0);
  } catch {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/**
 * A comparable body for any file.
 *
 * Binaries return a content DIGEST, never null. Returning null for both sides
 * made `null === null` true, so EVERY binary present in both trees classified
 * ALIGNED no matter how different it was — a logo could never be reported as
 * drifted once adopted. An unreadable file returns a digest of its own path so
 * two unreadable files never read as equal to each other.
 */
export function readComparableBody(file) {
  if (isBinaryFile(file)) {
    try {
      return `sha256:${createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
    } catch {
      return `unreadable:${file}`;
    }
  }
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return `unreadable:${file}`;
  }
}

/** True when a body came from readComparableBody's binary/unreadable path. */
export const isOpaqueBody = (body) =>
  typeof body === "string" && (body.startsWith("sha256:") || body.startsWith("unreadable:"));

/**
 * Normalise for comparison WITHOUT destroying line structure.
 *
 * An earlier version collapsed every run of whitespace to a single space. That
 * erases indentation, and in YAML, Markdown, .env files, .hbs templates and
 * multi-line template literals the indentation IS the meaning: a workflow whose
 * `steps:` key had been de-indented to a sibling of `build:` — so it never ran —
 * compared equal to the correct one. Only line endings and trailing whitespace
 * are noise; interior structure is signal.
 */
export function normaliseText(text) {
  if (text === null || text === undefined) return null;
  if (isOpaqueBody(text)) return text;
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .trim();
}
