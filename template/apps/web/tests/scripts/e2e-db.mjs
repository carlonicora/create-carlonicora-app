// Test-database lifecycle helper for scripts/e2e.sh. Run from the repo root:
//
//   node apps/web/tests/scripts/e2e-db.mjs recreate
//       drop + create the e2e database, EMPTY, and wait until it is online
//   node apps/web/tests/scripts/e2e-db.mjs check
//       exit 0 once every migration file has a matching :Migration node
//
// This is the only place the suite issues DDL. Connection details come from the
// repo-root .env (with .env.e2e layered on top), so the suite always talks to
// the same Neo4j server the app does.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import neo4j from "neo4j-driver";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..", "..");
dotenv.config({ path: path.join(repoRoot, ".env.e2e") });
dotenv.config({ path: path.join(repoRoot, ".env") });

const URI = process.env.NEO4J_URI ?? "bolt://localhost:7687";
const USER = process.env.NEO4J_USER ?? "neo4j";
const PASSWORD = process.env.NEO4J_PASSWORD ?? "password";
const TEST_DB = process.env.E2E_NEO4J_DATABASE ?? "{{name}}test";

/**
 * The number of :Migration nodes a fully migrated database must hold.
 *
 * Counted from disk rather than hard-coded, because an application ADDS
 * migrations over its life and a stale constant would let the runner start the
 * api against a half-migrated database. This mirrors the library's
 * MigratorService.discoverMigrations: every .ts/.js file in the directory that
 * is not a .d.ts, one :Migration node each.
 */
function expectedMigrations() {
  const dir = path.join(repoRoot, "apps", "api", "src", "neo4j.migrations");
  if (!fs.existsSync(dir)) throw new Error(`migrations directory not found: ${dir}`);
  return fs
    .readdirSync(dir)
    .filter((file) => (file.endsWith(".ts") || file.endsWith(".js")) && !file.endsWith(".d.ts")).length;
}

const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));

async function recreate() {
  const session = driver.session({ database: "system" });
  try {
    // DozerDB rejects the WAIT keyword, so the commands are issued bare and the
    // status is polled instead of waited on.
    await session.run(`DROP DATABASE \`${TEST_DB}\` IF EXISTS`);
    await session.run(`CREATE DATABASE \`${TEST_DB}\``);
    for (let attempt = 0; attempt < 60; attempt++) {
      const result = await session.run(
        `SHOW DATABASE \`${TEST_DB}\` YIELD currentStatus RETURN currentStatus`,
      );
      if (result.records[0]?.get("currentStatus") === "online") return;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`${TEST_DB} did not come online`);
  } finally {
    await session.close();
  }
}

async function check() {
  const expected = expectedMigrations();
  const session = driver.session({ database: TEST_DB });
  try {
    const result = await session.run(`MATCH (m:Migration) RETURN count(m) AS applied`);
    const applied = result.records[0]?.get("applied")?.toNumber?.() ?? 0;
    if (applied < expected) {
      console.error(`migrations applied: ${applied}/${expected}`);
      process.exitCode = 1;
    }
  } finally {
    await session.close();
  }
}

const command = process.argv[2];
try {
  if (command === "recreate") await recreate();
  else if (command === "check") await check();
  else {
    console.error("usage: e2e-db.mjs recreate|check");
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await driver.close();
}
