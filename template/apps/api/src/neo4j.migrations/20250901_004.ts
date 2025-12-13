/**
 * This migration creates the initial administrator user in the database.
 */

import { MigrationInterface } from "@carlonicora/nestjs-neo4jsonapi";

export const migration: MigrationInterface[] = [
  {
    query: `
          MERGE (u:User {id: $id})
          ON CREATE SET u.name = $name,
            u.email = $email,
            u.password = $password,
            u.isActive = $isActive,
            u.isDeleted = $isDeleted,
            u.createdAt = datetime(),
            u.updatedAt = datetime()
          WITH u
          MATCH (r:Role {id: $adminRoleId})
          MERGE (u)-[:MEMBER_OF]->(r)
        `,
    queryParams: {
      id: "a63553fb-5d3c-11ee-9dc3-0242ac120003",
      name: "Administrator",
      email: "admin@{{name}}.com",
      password: "$2a$10$ZDt9V644BLOC.HTBDrzFlOcg5WWaHIFcDaoPhSVaiEA9xGyp0NtOq",
      isActive: true,
      isDeleted: false,
      adminRoleId: "53394cb8-1e87-11ef-8b48-bed54b8f8aba",
    },
  },
];
