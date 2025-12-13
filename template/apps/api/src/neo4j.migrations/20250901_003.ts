/**
 * This migration creates the initial permissions for modules and features.
 * A module can belong to a feature, and a role can have permissions on a module or a feature.
 */

import { Action, MigrationInterface } from "@carlonicora/nestjs-neo4jsonapi";
import { permissionQuery } from "src/neo4j.migrations/queries/migration.queries";

export const migration: MigrationInterface[] = [
  ...[
    "f9e77c8f-bfd1-4fd4-80b0-e1d891ab7113",
    "db41ba46-e171-4324-8845-99353eba8568",
    "04cfc677-0fd2-4f5e-adf4-2483a00c0277",
  ].map((moduleId) => ({
    query: permissionQuery,
    queryParams: {
      roleId: "53394cb8-1e87-11ef-8b48-bed54b8f8aba",
      moduleId,
      permissions: JSON.stringify([
        { type: Action.Create, value: true },
        { type: Action.Read, value: true },
        { type: Action.Update, value: true },
        { type: Action.Delete, value: true },
      ]),
    },
  })),
  ...[
    "f9e77c8f-bfd1-4fd4-80b0-e1d891ab7113",
    "db41ba46-e171-4324-8845-99353eba8568",
    "04cfc677-0fd2-4f5e-adf4-2483a00c0277",
  ].map((moduleId) => ({
    query: permissionQuery,
    queryParams: {
      roleId: "2e1eee00-6cba-4506-9059-ccd24e4ea5b0",
      moduleId: moduleId,
      permissions: JSON.stringify([
        { type: Action.Create, value: true },
        { type: Action.Read, value: true },
        { type: Action.Update, value: true },
        { type: Action.Delete, value: true },
      ]),
    },
  })),
  ...["78567a47-baa8-47ed-890f-de48574a9cba", "e029e271-2896-43ad-87ef-19ab35363936"].map((moduleId) => ({
    query: permissionQuery,
    queryParams: {
      roleId: "2e1eee00-6cba-4506-9059-ccd24e4ea5b0",
      moduleId,
      permissions: JSON.stringify([
        { type: Action.Create, value: true },
        { type: Action.Read, value: true },
        { type: Action.Update, value: true },
        { type: Action.Delete, value: true },
      ]),
    },
  })),
];
