/**
 * This migration creates the initial set of features in the database.
 */

import { MigrationInterface } from "@carlonicora/nestjs-neo4jsonapi";
import { featureQuery, roleQuery } from "src/neo4j.migrations/queries/migration.queries";

export const migration: MigrationInterface[] = [
  {
    query: roleQuery,
    queryParams: {
      roleId: "53394cb8-1e87-11ef-8b48-bed54b8f8aba",
      roleName: "Administrators",
      isSelectable: false,
    },
  },
  {
    query: roleQuery,
    queryParams: {
      roleId: "2e1eee00-6cba-4506-9059-ccd24e4ea5b0",
      roleName: "Company Administrator",
      isSelectable: true,
    },
  },
  {
    query: featureQuery,
    queryParams: {
      featureId: "17036fb0-060b-4c83-a617-f32259819783",
      featureName: "Common",
      isProduction: true,
    },
  },
];
