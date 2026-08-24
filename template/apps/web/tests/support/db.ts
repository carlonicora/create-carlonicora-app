// Bolt helpers for the e2e suite: read-only probes for assertions, plus the one
// fixture the suite cannot obtain through the public API.
//
// This is TEST INFRASTRUCTURE living outside `src/`, so direct Cypher is
// sanctioned here and nowhere else. Application code always goes through
// AbstractRepository / AbstractService.
import { randomUUID } from "node:crypto";
import neo4j, { type Driver } from "neo4j-driver";
import { E2E } from "../e2e.env";

function driver(): Driver {
  return neo4j.driver(E2E.neo4j.uri, neo4j.auth.basic(E2E.neo4j.user, E2E.neo4j.password));
}

/**
 * Read-only Cypher probe against the e2e database, for assertions that the UI
 * cannot express (did the write actually land, and in the right shape). Returns
 * plain row objects — wrap numeric properties with `num()`.
 */
export async function testProbe(
  cypher: string,
  params: Record<string, unknown> = {},
): Promise<Record<string, unknown>[]> {
  const instance = driver();
  const session = instance.session({ database: E2E.neo4j.testDb });
  try {
    const result = await session.run(cypher, params);
    return result.records.map((record) => record.toObject());
  } finally {
    await session.close();
    await instance.close();
  }
}

/** neo4j-driver returns Integer objects for numeric properties; normalise. */
export function num(value: unknown): number {
  if (value && typeof (value as { toNumber?: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

/**
 * Creates the NON-ADMINISTRATOR fixture the (admin) role gate is proved against.
 *
 * Why Cypher and not the public API: registration is a multi-step flow
 * (register, e-mail an activation code, activate) whose first step fires a mail
 * side effect and whose second step is only reachable by reading the code back
 * out of the database anyway. Driving it would make the suite depend on the
 * registration mode and on an e-mail provider, to obtain a fixture that is pure
 * setup, not the thing under test.
 *
 * Why the password is not hashed here: the node COPIES `password` from the
 * administrator seeded by migration 20250901_004, so this user logs in with the
 * same plaintext (E2E.administrator.password) without the suite taking a bcrypt
 * dependency. If that migration's hash changes, both personas move together.
 *
 * The shape mirrors what the login read path expects:
 *   (user)-[:BELONGS_TO]->(company)
 *   (user)-[:HAS_MEMBERSHIP]->(:Membership)-[:IN_COMPANY]->(company)
 *   (membership)-[:HAS_ROLE]->(:Role)
 * The role granted is CompanyAdministrator — a normal tenant role, seeded by
 * migration 20250901_001. That makes the fixture the STRONGEST version of an
 * ordinary user: privileged inside its own company, and still refused by the
 * platform-administrator gate on the (admin) route group.
 *
 * Idempotent: every node is MERGEd on a fixed id, so a re-run of the `setup`
 * project (or a Playwright worker restart) does not duplicate anything.
 */
export async function createNonAdministratorUser(): Promise<void> {
  const instance = driver();
  const session = instance.session({ database: E2E.neo4j.testDb });
  try {
    // NOTE: no backtick may appear anywhere below, comments included — the
    // whole block is a template literal and a backtick would terminate it.
    const result = await session.run(
      `
      MATCH (administrator:User {id: $administratorId})
      MATCH (role:Role {id: $roleId})
      MERGE (company:Company {id: $companyId})
        ON CREATE SET company.name = $companyName,
          company.createdAt = datetime(),
          company.updatedAt = datetime()
      MERGE (user:User {id: $userId})
        ON CREATE SET user.email = $email,
          user.name = $name,
          user.isActive = true,
          user.isDeleted = false,
          user.code = $code,
          user.codeExpiration = datetime($codeExpiration),
          user.createdAt = datetime(),
          user.updatedAt = datetime()
      SET user.password = administrator.password
      MERGE (user)-[:BELONGS_TO]->(company)
      MERGE (user)-[:HAS_MEMBERSHIP]->(membership:Membership)-[:IN_COMPANY]->(company)
        ON CREATE SET membership.id = $membershipId,
          membership.createdAt = datetime(),
          membership.updatedAt = datetime()
      MERGE (membership)-[:HAS_ROLE]->(role)
      WITH company, user
      OPTIONAL MATCH (feature:Feature)
      FOREACH (f IN CASE WHEN feature IS NULL THEN [] ELSE [feature] END |
        MERGE (company)-[:HAS_FEATURE]->(f)
      )
      RETURN user.id AS userId
      `,
      {
        administratorId: E2E.administrator.id,
        roleId: E2E.roles.companyAdministrator,
        companyId: E2E.member.companyId,
        companyName: E2E.member.companyName,
        userId: E2E.member.id,
        email: E2E.member.email.toLowerCase(),
        name: E2E.member.name,
        membershipId: randomUUID(),
        code: randomUUID(),
        codeExpiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    );

    if (!result.records[0]) {
      throw new Error(
        "createNonAdministratorUser: the seeded administrator or the Company Administrator role is missing " +
          "from the e2e database — did the worker's migrations run?",
      );
    }
  } finally {
    await session.close();
    await instance.close();
  }
}
