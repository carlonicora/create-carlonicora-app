// Loads the repo-root .env, and must be imported for its side effect as the
// FIRST import of every entrypoint.
//
// Why this is a module and not three lines inside main.ts: it used to sit
// between main.ts's imports, and that only worked because TypeScript's
// CommonJS emit preserves the interleaving of `require` calls and statements —
// so `dotenv.config()` ran before `@carlonicora/nestjs-neo4jsonapi` was
// required. Every ESM-correct transpiler (swc, esbuild) hoists all imports
// above such a statement instead, which loads the library before any env var
// exists and kills bootstrap with "JwtStrategy requires a secret or key"
// (observed 2026-08-30 while evaluating runners to replace ts-node).
//
// ESM guarantees the ORDER of imports, not the position of statements relative
// to them. Expressing the dependency as an import is therefore the only form
// that survives a change of compiler or module system.
//
// __dirname is apps/api/src under a source runner and apps/api/dist after a
// build; both are three levels below the repo root, so this one path is
// correct in either case. Keep this file directly in src/ — moving it deeper
// changes that depth.
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
