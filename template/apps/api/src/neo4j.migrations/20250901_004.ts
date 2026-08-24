/**
 * This migration creates the initial administrator user in the database.
 *
 * The administrator is a PLATFORM administrator: it holds the Administrator role
 * on a membership with no IN_COMPANY edge, and therefore belongs to no company.
 * That shape is not incidental — `AuthRepository.createSession` branches on
 * exactly it ("holds Administrator and has no company") to build a session
 * without a company in scope. Seeding the role any other way sends login down
 * the company branch, which dereferences `auth.user.company.id` on a
 * company-less user and fails with a 500 before a token is ever issued.
 *
 * The role edge is therefore granted with the library's own `grantPlatformRole`
 * rather than hand-written Cypher, so this seed can never drift from the
 * membership model the rest of the codebase reads through `membershipRoleMatch`.
 */

import { grantPlatformRole, MigrationInterface } from "@carlonicora/nestjs-neo4jsonapi";

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
          ${grantPlatformRole({ userAlias: "u" })}
        `,
    queryParams: {
      id: "a63553fb-5d3c-11ee-9dc3-0242ac120003",
      name: "Administrator",
      email: "admin@{{name}}.com",
      password: "$2a$10$ZDt9V644BLOC.HTBDrzFlOcg5WWaHIFcDaoPhSVaiEA9xGyp0NtOq",
      isActive: true,
      isDeleted: false,
      // Consumed by grantPlatformRole: $roleId is the role to grant, $membershipId
      // seeds the platform membership when the user has none yet.
      roleId: "53394cb8-1e87-11ef-8b48-bed54b8f8aba",
      membershipId: "0195c1e2-7f3a-7c21-9c4e-4f6c2b8d5a10",
    },
  },
];
