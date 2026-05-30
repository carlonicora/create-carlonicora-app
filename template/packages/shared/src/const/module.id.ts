/**
 * Module IDs as seeded in apps/api/src/neo4j.migrations/20250901_002.ts.
 * Authoritative identity for the (Module) nodes in Neo4j.
 *
 * Feature modules register their entity descriptors using these IDs — NOT by
 * name — so renames in the migration never silently desync the catalog.
 *
 * Keep this file in sync with the migration file. Add a new entry here for
 * every business module you introduce, then run `pnpm build-module-id-map`
 * and `pnpm generate:rbac-paths` in apps/api.
 */
export const ModuleId = {
  // Framework modules (20250901_002.ts)
  Auth: "035fe8a6-d467-40c0-9d1d-6a87f0dd286e",
  Company: "f9e77c8f-bfd1-4fd4-80b0-e1d891ab7113",
  Feature: "025fdd23-2803-4360-9fd9-eaa3612c2e23",
  Notification: "9259d704-c670-4e77-a3a1-a728ffc5be3d",
  Role: "9f6416e6-7b9b-4e1a-a99f-833191eca8a9",
  S3: "db41ba46-e171-4324-8845-99353eba8568",
  User: "04cfc677-0fd2-4f5e-adf4-2483a00c0277",
  HowTo: "6f975207-0df3-4c0d-b541-ed5dc04487b2",
} as const;

export type ModuleId = (typeof ModuleId)[keyof typeof ModuleId];
