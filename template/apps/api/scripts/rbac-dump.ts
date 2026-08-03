/**
 * One-shot developer script: read the live RBAC state from Neo4j and emit
 * `apps/api/src/rbac/permissions.ts`.
 *
 * USAGE
 *   pnpm --filter {{name}}-api rbac:dump
 *
 * WHEN TO RUN
 *   • First-time setup of a new environment (no `permissions.ts` yet, or
 *     the file exists but you want to overwrite it from current DB state).
 *   • After making manual permission edits in Neo4j during development —
 *     dump pulls them into the file so the worker reconciler (which runs
 *     on every worker bootstrap) doesn't immediately revert them.
 *
 * Production note: this script is for developers only. It writes a source
 * file in your repo. Never wire it into a runtime endpoint or a deploy
 * pipeline.
 *
 * The actual logic lives in the library — this file just supplies the
 * app-specific bits (env, driver, RoleId/ModuleId from @{{name}}/shared,
 * output path).
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import neo4j from "neo4j-driver";
import { ModuleId, RoleId } from "@{{name}}/shared";
import { dumpRbacMatrix } from "@carlonicora/nestjs-neo4jsonapi";

async function main() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI!,
    neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!),
  );
  try {
    const result = await dumpRbacMatrix({
      driver,
      database: process.env.NEO4J_DATABASE,
      // Invert the enums into UUID → PascalCase maps so the emitted file
      // references `RoleId.X` / `ModuleId.X` instead of raw UUIDs.
      roleNames: Object.fromEntries(Object.entries(RoleId).map(([k, v]) => [v, k])),
      moduleNames: Object.fromEntries(Object.entries(ModuleId).map(([k, v]) => [v, k])),
      administratorRoleId: RoleId.Administrator,
      outputPath: path.resolve(__dirname, "../src/rbac/permissions.ts"),
    });
    console.log(`Wrote ${result.bytesWritten} bytes to ${result.path}`);
  } finally {
    await driver.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
