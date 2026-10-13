import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DOMAIN_HEADINGS,
  DOTFILE_RENAMES,
  EN_MANIFEST,
  FRONT_MATTER_KEYS,
  HANDBOOK,
  SUBMODULE_DIRS,
  checkDomainHeadings,
  checkFile,
  checkFrontMatter,
  checkManifest,
  extractInlinePaths,
  extractLinks,
  findPlaceholders,
  isFoundationChapter,
  isRulebookCopy,
  isTemplateMode,
  isUninitialisedSubmodule,
  resolveCitedPath,
  rootEntriesFor,
  slugify,
  submoduleSkip,
  undottedSpelling,
} from "./check-handbook.mjs";

/** Build a throwaway directory tree. Keys are relative paths, values file contents. */
function fixture(files, dirs = []) {
  const root = mkdtempSync(join(tmpdir(), "check-handbook-"));
  for (const d of dirs) mkdirSync(join(root, d), { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

const FM = "---\ntitle: X\nsection: 05-foundations\n---\n";

test("extractInlinePaths keeps repo paths and drops globs and symbols", () => {
  const md = "See `apps/api/src/main.ts` and `apps/web/src/features/*/data/` and `userHasAccess()` and `README.md`.";
  assert.deepEqual(extractInlinePaths(md, ["README.md"]), ["apps/api/src/main.ts", "README.md"]);
});

test("extractInlinePaths skips {{name}} citations and spaced tokens", () => {
  const md = "`apps/web/src/app/[locale]/{{name}}/page.tsx` and `pnpm dev` and `scripts/e2e.sh`";
  assert.deepEqual(extractInlinePaths(md, []), ["scripts/e2e.sh"]);
});

test("extractInlinePaths recognises the template's path prefixes", () => {
  const md = "`docs/handbook/README.md` `tests/x.ts` `test/y.ts` `.vscode/settings.json` `.husky/pre-commit` `infrastructure/x.tf`";
  assert.deepEqual(extractInlinePaths(md, []), [
    "docs/handbook/README.md",
    "tests/x.ts",
    "test/y.ts",
    ".vscode/settings.json",
    ".husky/pre-commit",
  ]);
});

test("extractInlinePaths ignores fenced code blocks", () => {
  const md = "```bash\ncat apps/api/nope.ts\n```\n`apps/api/src/main.ts`";
  assert.deepEqual(extractInlinePaths(md, []), ["apps/api/src/main.ts"]);
});

test("extractLinks returns relative links with anchors split", () => {
  const md = "[a](../01-architecture/topology.md#trust-boundaries) [b](https://x.y) [c](mailto:a@b.c) [d](./x.md)";
  assert.deepEqual(extractLinks(md), [
    { target: "../01-architecture/topology.md", anchor: "trust-boundaries" },
    { target: "./x.md", anchor: "" },
  ]);
});

test("slugify matches GitHub heading slugs", () => {
  assert.equal(slugify("Permissions and gating"), "permissions-and-gating");
  assert.equal(slugify("API vs WORKER (modes)"), "api-vs-worker-modes");
  assert.equal(slugify("`{CURSOR}` placeholder"), "cursor-placeholder");
});

test("checkFrontMatter requires exactly title and section", () => {
  assert.deepEqual(FRONT_MATTER_KEYS, ["title", "section"]);
  assert.deepEqual(checkFrontMatter("---\ntitle: X\nsection: 03-backend\n---\n# X\n"), []);
  assert.deepEqual(checkFrontMatter("---\nsection: 03-backend\ntitle: X\n---\n# X\n"), []);
  assert.deepEqual(checkFrontMatter("# X\n"), ["missing front matter"]);
  assert.equal(checkFrontMatter("---\ntitle: X\n---\n").length, 1);
  assert.equal(checkFrontMatter("---\nsection: 03-backend\n---\n").length, 1);
});

test("checkFrontMatter rejects sources_verified so the upstream key cannot creep back in", () => {
  const problems = checkFrontMatter("---\ntitle: X\nsection: 03-backend\nsources_verified: 2026-09-11\n---\n");
  assert.equal(problems.length, 1);
  assert.match(problems[0], /unexpected key "sources_verified"/);
});

test("checkFrontMatter rejects the Italian source key and any other third key", () => {
  assert.equal(checkFrontMatter("---\ntitle: X\nsection: 03-backend\nsource: ../x.md\n---\n").length, 1);
  const two = checkFrontMatter("---\ntitle: X\nsection: 03-backend\nsource: ../x.md\nowner: me\n---\n");
  assert.equal(two.length, 2);
});

test("checkDomainHeadings enforces the twelve foundation H2s in order and no extras", () => {
  assert.equal(DOMAIN_HEADINGS.length, 12);
  assert.equal(DOMAIN_HEADINGS[0], "Purpose");
  assert.equal(DOMAIN_HEADINGS[2], "Graph model");
  assert.equal(DOMAIN_HEADINGS[10], "Where to look");
  assert.equal(DOMAIN_HEADINGS[11], "Gaps and drift");
  const good = DOMAIN_HEADINGS.map((h) => `## ${h}\n\ntext\n`).join("\n");
  assert.deepEqual(checkDomainHeadings(good), []);
  const reordered = [...DOMAIN_HEADINGS]
    .reverse()
    .map((h) => `## ${h}\n`)
    .join("\n");
  assert.ok(checkDomainHeadings(reordered).length > 0);
  assert.match(checkDomainHeadings(reordered)[0], /H2 #1 should be "Purpose"/);
  assert.ok(checkDomainHeadings(good + "\n## Extra\n").length > 0);
  assert.ok(checkDomainHeadings(good.replace("## Tests\n", "")).length > 0);
  assert.deepEqual(checkDomainHeadings(good.replace("## Flows\n", "## Flows\n\n### Create\n")), []);
});

test("checkDomainHeadings ignores H2s inside fenced blocks", () => {
  const good = DOMAIN_HEADINGS.map((h) => `## ${h}\n\ntext\n`).join("\n");
  assert.deepEqual(checkDomainHeadings("```md\n## Not a heading\n```\n" + good), []);
});

test("findPlaceholders is case-sensitive so the todos module is not flagged", () => {
  assert.deepEqual(findPlaceholders("the todos module and `Todo`"), []);
  assert.equal(findPlaceholders("TODO later").length, 1);
  assert.equal(findPlaceholders("TBD").length, 1);
  assert.equal(findPlaceholders("FIXME").length, 1);
  assert.equal(findPlaceholders("Lorem Ipsum").length, 1);
});

test("manifest has 98 unique entries, all markdown, none localised or product-specific", () => {
  assert.equal(EN_MANIFEST.length, 98);
  assert.equal(new Set(EN_MANIFEST).size, 98);
  for (const entry of EN_MANIFEST) {
    assert.ok(entry.endsWith(".md"), `${entry} is not markdown`);
    assert.ok(!entry.startsWith("/"), `${entry} is not relative`);
    assert.ok(!entry.startsWith("it/"), `${entry} is an Italian mirror`);
    assert.ok(!entry.startsWith("05-domains/"), `${entry} is a product-specific domain page`);
    assert.ok(!entry.startsWith("07-corpus/"), `${entry} is a product-specific corpus page`);
  }
  assert.ok(EN_MANIFEST.includes("05-foundations/README.md"));
  assert.ok(EN_MANIFEST.includes("03-backend/token-usage-and-credits.md"));
  assert.ok(!EN_MANIFEST.includes("04-frontend/marketing-site.md"));
  assert.equal(EN_MANIFEST.filter((e) => e.startsWith("05-foundations/")).length, 12);
  assert.equal(EN_MANIFEST.filter((e) => e.startsWith("02-framework/rulebook/")).length, 22);
});

test("isRulebookCopy exempts verbatim copies but not the rulebook README", () => {
  assert.equal(isRulebookCopy(join(HANDBOOK, "02-framework/rulebook/backend/02-dtos.md")), true);
  assert.equal(isRulebookCopy(join(HANDBOOK, "02-framework/rulebook/core-principles.md")), true);
  assert.equal(isRulebookCopy(join(HANDBOOK, "02-framework/rulebook/README.md")), false);
  assert.equal(isRulebookCopy(join(HANDBOOK, "02-framework/overview.md")), false);
});

test("isFoundationChapter covers 05-foundations except its README", () => {
  assert.equal(isFoundationChapter(join(HANDBOOK, "05-foundations/identity-and-tenancy.md")), true);
  assert.equal(isFoundationChapter(join(HANDBOOK, "05-foundations/_template.md")), true);
  assert.equal(isFoundationChapter(join(HANDBOOK, "05-foundations/README.md")), false);
  assert.equal(isFoundationChapter(join(HANDBOOK, "03-backend/testing.md")), false);
});

test("undottedSpelling mirrors the scaffolder rename map at any depth", () => {
  assert.equal(undottedSpelling(".env.example"), "env.example");
  assert.equal(undottedSpelling(".pnpmfile.cjs"), "pnpmfile.cjs");
  assert.equal(undottedSpelling(".gitmodules"), "gitmodules");
  assert.equal(undottedSpelling("apps/web/.swcrc"), "apps/web/swcrc");
  assert.equal(undottedSpelling(".github/workflows/ci.yml"), null);
  assert.equal(undottedSpelling("apps/api/src/main.ts"), null);
  for (const [undotted, dotted] of Object.entries(DOTFILE_RENAMES)) {
    assert.equal(undottedSpelling(dotted), undotted);
  }
});

test("isTemplateMode is true only when gitmodules exists without its dot", () => {
  const templateish = fixture({ gitmodules: "[submodule]\n" });
  const appish = fixture({ ".gitmodules": "[submodule]\n", gitmodules: "stale\n" });
  const neither = fixture({ "package.json": "{}" });
  try {
    assert.equal(isTemplateMode(templateish), true);
    assert.equal(isTemplateMode(appish), false);
    assert.equal(isTemplateMode(neither), false);
  } finally {
    for (const d of [templateish, appish, neither]) rmSync(d, { recursive: true, force: true });
  }
});

test("resolveCitedPath falls back to the un-dotted spelling only in template mode", () => {
  const root = fixture({ gitmodules: "x", "env.example": "x", "apps/web/swcrc": "{}" });
  try {
    assert.ok(resolveCitedPath(".env.example", { root, templateMode: true }));
    assert.ok(resolveCitedPath("apps/web/.swcrc", { root, templateMode: true }));
    assert.ok(resolveCitedPath("gitmodules", { root, templateMode: true }));
    assert.equal(resolveCitedPath(".env.example", { root, templateMode: false }), null);
    assert.equal(resolveCitedPath(".npmrc", { root, templateMode: true }), null);
    assert.equal(resolveCitedPath("apps/web/nope.ts", { root, templateMode: true }), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rootEntriesFor adds the dotted spellings the pages cite in template mode", () => {
  const root = fixture({ gitmodules: "x", "env.example": "x", "package.json": "{}" });
  try {
    const templated = rootEntriesFor(root, true);
    assert.ok(templated.includes(".env.example"));
    assert.ok(templated.includes(".gitmodules"));
    assert.ok(templated.includes("package.json"));
    const plain = rootEntriesFor(root, false);
    assert.ok(!plain.includes(".env.example"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("isUninitialisedSubmodule is true for missing, empty and .gitkeep-only directories", () => {
  const root = fixture(
    { "packages/nextjs-jsonapi/.gitkeep": "", "packages/shared/package.json": "{}" },
    ["packages/empty"]
  );
  try {
    assert.equal(isUninitialisedSubmodule("packages/nestjs-neo4jsonapi", { root }), true);
    assert.equal(isUninitialisedSubmodule("packages/empty", { root }), true);
    assert.equal(isUninitialisedSubmodule("packages/nextjs-jsonapi", { root }), true);
    assert.equal(isUninitialisedSubmodule("packages/shared", { root }), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("submoduleSkip names the submodule only while it is uninitialised", () => {
  assert.deepEqual(SUBMODULE_DIRS, ["packages/nestjs-neo4jsonapi", "packages/nextjs-jsonapi"]);
  const root = fixture({
    "packages/nestjs-neo4jsonapi/.gitkeep": "",
    "packages/nextjs-jsonapi/src/index.ts": "export {};",
  });
  try {
    assert.equal(submoduleSkip("packages/nestjs-neo4jsonapi/src/bootstrap/bootstrap.ts", { root }), "packages/nestjs-neo4jsonapi");
    assert.equal(submoduleSkip("packages/nextjs-jsonapi/src/index.ts", { root }), null);
    assert.equal(submoduleSkip("packages/shared/src/index.ts", { root }), null);
    assert.equal(submoduleSkip("apps/api/src/main.ts", { root }), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("checkFile flags a missing citation and accepts a real one", () => {
  const root = fixture({
    gitmodules: "x",
    "apps/api/src/main.ts": "",
    "docs/handbook/03-backend/bootstrap.md":
      "---\ntitle: Bootstrap\nsection: 03-backend\n---\n\nSee `apps/api/src/main.ts` and `apps/api/src/gone.ts`.\n",
  });
  try {
    const handbook = join(root, "docs/handbook");
    const problems = checkFile(join(handbook, "03-backend/bootstrap.md"), {
      rootEntries: rootEntriesFor(root, true),
      root,
      handbook,
      templateMode: true,
    });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /cited path does not exist: apps\/api\/src\/gone\.ts/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("checkFile resolves a dotted citation against the un-dotted template file", () => {
  const root = fixture({
    gitmodules: "x",
    "env.example": "PORT=4050",
    "apps/web/swcrc": "{}",
    "docs/handbook/01-architecture/configuration.md":
      "---\ntitle: Configuration\nsection: 01-architecture\n---\n\n`.env.example` and `apps/web/.swcrc`.\n",
  });
  try {
    const handbook = join(root, "docs/handbook");
    assert.deepEqual(
      checkFile(join(handbook, "01-architecture/configuration.md"), {
        rootEntries: rootEntriesFor(root, true),
        root,
        handbook,
        templateMode: true,
      }),
      []
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("checkFile skips and counts paths inside an uninitialised submodule", () => {
  const root = fixture({
    gitmodules: "x",
    "packages/nestjs-neo4jsonapi/.gitkeep": "",
    "docs/handbook/02-framework/overview.md":
      "---\ntitle: Overview\nsection: 02-framework\n---\n\n" +
      "`packages/nestjs-neo4jsonapi/src/bootstrap/bootstrap.ts` and " +
      "[src](../../../packages/nestjs-neo4jsonapi/README.md) and `packages/shared/gone.ts`.\n",
  });
  try {
    const handbook = join(root, "docs/handbook");
    const stats = { skipped: 0 };
    const problems = checkFile(join(handbook, "02-framework/overview.md"), {
      rootEntries: rootEntriesFor(root, true),
      root,
      handbook,
      templateMode: true,
      stats,
    });
    assert.equal(stats.skipped, 2);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /packages\/shared\/gone\.ts/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("checkFile applies the twelve headings to a foundation chapter and not to its README", () => {
  const body = DOMAIN_HEADINGS.map((h) => `## ${h}\n\ntext\n`).join("\n");
  const root = fixture({
    gitmodules: "x",
    "docs/handbook/05-foundations/identity-and-tenancy.md": FM + "\n" + body,
    "docs/handbook/05-foundations/audit-and-activity.md": FM + "\n## Purpose\n\ntext\n",
    "docs/handbook/05-foundations/README.md": FM + "\n## Anything\n\ntext\n",
    "docs/handbook/03-backend/testing.md":
      "---\ntitle: Testing\nsection: 03-backend\n---\n\n## Anything\n\ntext\n",
  });
  try {
    const handbook = join(root, "docs/handbook");
    const opts = { rootEntries: [], root, handbook, templateMode: true };
    assert.deepEqual(checkFile(join(handbook, "05-foundations/identity-and-tenancy.md"), opts), []);
    assert.ok(checkFile(join(handbook, "05-foundations/audit-and-activity.md"), opts).length > 0);
    assert.deepEqual(checkFile(join(handbook, "05-foundations/README.md"), opts), []);
    assert.deepEqual(checkFile(join(handbook, "03-backend/testing.md"), opts), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("checkFile reports broken links and broken anchors", () => {
  const root = fixture({
    gitmodules: "x",
    "docs/handbook/03-backend/testing.md": "---\ntitle: Testing\nsection: 03-backend\n---\n\n## Where to look\n",
    "docs/handbook/03-backend/bootstrap.md":
      "---\ntitle: Bootstrap\nsection: 03-backend\n---\n\n" +
      "[ok](./testing.md#where-to-look) [bad anchor](./testing.md#nope) [gone](./missing.md)\n",
  });
  try {
    const handbook = join(root, "docs/handbook");
    const problems = checkFile(join(handbook, "03-backend/bootstrap.md"), {
      rootEntries: [],
      root,
      handbook,
      templateMode: true,
    });
    assert.equal(problems.length, 2);
    assert.ok(problems.some((p) => /broken anchor: \.\/testing\.md#nope/.test(p)));
    assert.ok(problems.some((p) => /broken link: \.\/missing\.md/.test(p)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("checkFile exempts rulebook copies from path and link checks but not from placeholders", () => {
  const abs = join(HANDBOOK, "02-framework/rulebook/backend/02-dtos.md");
  assert.equal(isRulebookCopy(abs), true);
  assert.equal(isRulebookCopy(join(HANDBOOK, "02-framework/rulebook/README.md")), false);
});

test("checkFile does not require front matter on the root README", () => {
  const root = fixture({ gitmodules: "x", "README.md": "# App\n\nNo front matter here.\n" });
  try {
    assert.deepEqual(
      checkFile(join(root, "README.md"), { rootEntries: [], root, handbook: join(root, "docs/handbook"), templateMode: true }),
      []
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("checkManifest reports both a missing file and an unlisted one", () => {
  const root = fixture({
    "docs/handbook/README.md": "x",
    "docs/handbook/00-start-here/stray.md": "x",
  });
  try {
    const handbook = join(root, "docs/handbook");
    const problems = checkManifest(handbook, ["README.md", "00-start-here/glossary.md"]);
    assert.ok(problems.includes("00-start-here/glossary.md: missing from disk"));
    assert.ok(problems.includes("00-start-here/stray.md: not in manifest"));
    assert.equal(problems.length, 2);
    assert.deepEqual(checkManifest(handbook, ["README.md", "00-start-here/stray.md"]), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
