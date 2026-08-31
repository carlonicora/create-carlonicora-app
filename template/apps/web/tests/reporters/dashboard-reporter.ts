/**
 * Live-event reporter for the e2e dashboard (`scripts/e2e-dashboard.mjs`).
 *
 * It is attached by `playwright.config.ts` ONLY when `E2E_DASH_EVENTS` is set,
 * so a normal `./scripts/e2e.sh` run is completely unaffected.
 *
 * Transport is deliberately a plain append-only NDJSON file rather than a
 * socket: the dashboard tails it, so (a) nothing in the test process can block
 * on a network peer, (b) the file survives the dashboard being restarted, and
 * (c) a page reload replays the whole run instead of only what happened after
 * the browser reconnected.
 *
 * The same reporter serves BOTH passes the dashboard makes:
 *   1. `playwright test --list` with `E2E_DASH_LIST=1` — `onBegin` fires even
 *      under --list, so this enumerates every test (no stack required) and the
 *      page can paint the full pending list during the ~3-5 min stack boot.
 *      `runEnd` is suppressed in that pass, otherwise the UI would believe the
 *      run had already finished.
 *   2. the real run inside `scripts/e2e.sh` — begin/end/runEnd events.
 *
 * `TestCase.id` here is byte-identical to the `id` the JSON reporter emits for
 * the same spec, so the catalogue and the live events join on it directly.
 */
import fs from "node:fs";
import path from "node:path";
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

// Playwright colours its error messages; the dashboard renders them as HTML.
// Built from a char code so no raw ESC byte ends up in this source file.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
const stripAnsi = (value: string): string => value.replace(ANSI, "");

type DashboardEvent = Record<string, unknown> & { t: string };

export default class DashboardReporter implements Reporter {
  private fd: number | undefined;
  private rootDir = "";
  private readonly listing = process.env.E2E_DASH_LIST === "1";

  constructor() {
    const target = process.env.E2E_DASH_EVENTS;
    if (!target) return;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    this.fd = fs.openSync(target, "a");
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.rootDir = config.rootDir;
    this.emit({
      t: "catalogue",
      listing: this.listing,
      tests: suite.allTests().map((test) => this.catalogue(test)),
    });
  }

  onTestBegin(test: TestCase, result: TestResult): void {
    this.emit({ t: "begin", id: test.id, retry: result.retry });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.emit({
      t: "end",
      id: test.id,
      status: result.status,
      outcome: test.outcome(),
      duration: result.duration,
      retry: result.retry,
      errors: result.errors
        .map((error) => stripAnsi(error.message ?? String(error.value ?? "")).trim())
        .filter(Boolean),
    });
  }

  onEnd(result: FullResult): void {
    if (!this.listing) this.emit({ t: "runEnd", status: result.status });
    if (this.fd !== undefined) fs.closeSync(this.fd);
    this.fd = undefined;
  }

  private emit(event: DashboardEvent): void {
    if (this.fd === undefined) return;
    fs.writeSync(this.fd, `${JSON.stringify({ ...event, at: Date.now() })}\n`);
  }

  /**
   * `titlePath()` is `["", <project>, <file>, ...describe blocks, <title>]`, so
   * the describe chain is everything between the file and the title itself.
   */
  private catalogue(test: TestCase): Record<string, unknown> {
    const titlePath = test.titlePath().filter((part) => part !== "");
    return {
      id: test.id,
      title: test.title,
      project: test.parent.project()?.name ?? titlePath[0] ?? "",
      file: path.relative(this.rootDir, test.location.file),
      line: test.location.line,
      describes: titlePath.slice(2, -1),
      expected: test.expectedStatus,
    };
  }
}
