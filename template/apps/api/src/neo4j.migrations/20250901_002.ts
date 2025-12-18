/**
 * This migration creates the initial set of modules in the database.
 */

import { Action, MigrationInterface } from "@carlonicora/nestjs-neo4jsonapi";
import { moduleQuery } from "src/neo4j.migrations/queries/migration.queries";

export const migration: MigrationInterface[] = [
  {
    query: moduleQuery,
    queryParams: {
      moduleName: "Auth",
      moduleId: "035fe8a6-d467-40c0-9d1d-6a87f0dd286e",
      featureId: "17036fb0-060b-4c83-a617-f32259819783",
      isCore: true,
      permissions: JSON.stringify([
        { type: Action.Create, value: true },
        { type: Action.Read, value: true },
        { type: Action.Update, value: true },
        { type: Action.Delete, value: true },
      ]),
    },
  },
  {
    query: moduleQuery,
    queryParams: {
      moduleName: "Company",
      moduleId: "f9e77c8f-bfd1-4fd4-80b0-e1d891ab7113",
      featureId: "17036fb0-060b-4c83-a617-f32259819783",
      isCore: true,
      permissions: JSON.stringify([{ type: Action.Read, value: true }]),
    },
  },
  {
    query: moduleQuery,
    queryParams: {
      moduleName: "Feature",
      moduleId: "025fdd23-2803-4360-9fd9-eaa3612c2e23",
      featureId: "17036fb0-060b-4c83-a617-f32259819783",
      isCore: true,
      permissions: JSON.stringify([{ type: Action.Read, value: true }]),
    },
  },
  {
    query: moduleQuery,
    queryParams: {
      moduleName: "Notification",
      moduleId: "9259d704-c670-4e77-a3a1-a728ffc5be3d",
      featureId: "17036fb0-060b-4c83-a617-f32259819783",
      isCore: true,
      permissions: JSON.stringify([
        { type: Action.Read, value: true },
        { type: Action.Update, value: true },
      ]),
    },
  },
  {
    query: moduleQuery,
    queryParams: {
      moduleName: "Role",
      moduleId: "9f6416e6-7b9b-4e1a-a99f-833191eca8a9",
      featureId: "17036fb0-060b-4c83-a617-f32259819783",
      isCore: true,
      permissions: JSON.stringify([{ type: Action.Read, value: true }]),
    },
  },
  {
    query: moduleQuery,
    queryParams: {
      moduleName: "S3",
      moduleId: "db41ba46-e171-4324-8845-99353eba8568",
      featureId: "17036fb0-060b-4c83-a617-f32259819783",
      isCore: true,
      permissions: JSON.stringify([{ type: Action.Read, value: true }]),
    },
  },
  {
    query: moduleQuery,
    queryParams: {
      moduleName: "User",
      moduleId: "04cfc677-0fd2-4f5e-adf4-2483a00c0277",
      featureId: "17036fb0-060b-4c83-a617-f32259819783",
      isCore: true,
      permissions: JSON.stringify([
        { type: Action.Read, value: true },
        { type: Action.Update, value: "id" },
      ]),
    },
  },
];
