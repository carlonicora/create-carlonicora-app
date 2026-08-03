---
id: date-handling
title: "Date and DateTime Handling (cross-cutting)"
applies_to: both
layer: meta
depends_on:
  - core-principles
source_files:
  - "apps/api/src/features/*/entities/*.ts"
  - "apps/api/src/features/*/dtos/*.ts"
  - "apps/api/src/features/*/repositories/*.ts"
  - "apps/web/src/features/*/data/*.ts"
  - "apps/web/src/features/*/data/*Interface.ts"
  - "packages/nestjs-neo4jsonapi/src/core/neo4j/abstracts/abstract.repository.ts"
related_docs:
  - backend-01-entity-basics
  - backend-02-dtos
  - backend-03-repositories
  - frontend-01-models
  - frontend-02-interfaces
  - anti-patterns
enforcement: critical
last_updated: "2026-05-17"
---

# Date and DateTime Handling

> A single rule, end-to-end: **dates and datetimes are stored as native Neo4j
> temporal types - never as strings**. The framework guarantees this only if
> every layer respects the contract below. Read this before touching any field
> that represents a calendar date or a point in time.

---

## WHEN TO USE
Read this file when:
- Adding a new field that represents a date or a date+time on any entity
- Reviewing or modifying any field whose name ends in `_at`, `_on`, `_date`, `_until`, `_from`, or similar
- Writing a custom Cypher query (in a repository) that sets a date/datetime property
- Implementing `rehydrate()` or `createJsonApi()` on a frontend model
- Debugging a value that arrives in the database as a string instead of a temporal type, or a value that shifts by one day across timezones

---

## THE NON-NEGOTIABLE RULES

1. **A calendar date (no time component) MUST use `type: "date"`** in the entity descriptor - never `"string"`, never `"datetime"`.
   *Examples: invoice date, due date, hire date, birth date, contract start.*

2. **A point in time (timestamped event) MUST use `type: "datetime"`** in the entity descriptor - never `"string"`, never `"date"`.
   *Examples: `createdAt`, `updatedAt`, `signedOffAt`, `confirmedAt`, `processedAt`.*

3. **Custom Cypher writes MUST cast scalars with `date(left($field, 10))` or `datetime($field)`** - never `SET n.foo = $foo` for a date/datetime field. The framework only auto-casts properties declared in the descriptor and routed through `create` / `put` / `patch`; ad-hoc `executeInTransaction` and custom service helpers bypass that path.

4. **Frontend `createJsonApi()` MUST emit dates as `YYYY-MM-DD` strings via `formatLocalDate(d)`** for any `type: "date"` field. Passing a raw JS `Date` causes `JSON.stringify` to call `.toISOString()`, which UTC-shifts and can move the value by a day.

5. **Frontend `createJsonApi()` MUST emit datetimes as ISO 8601 strings** (use `d.toISOString()` - UTC shift is correct for an instant in time).

6. **DTOs MUST use `@IsDateString()`** on date/datetime attributes. They are always strings on the wire; the type cast to a temporal happens in the Cypher write.

7. **Frontend interfaces MUST type date/datetime getters as `Date`** (or `Date | undefined`), and `rehydrate()` MUST parse with `new Date(...)`. The wire format is a string; in TypeScript memory the value is a `Date`.

If any of these rules is broken, the value lands in Neo4j as a plain `String`. Queries that filter with `<`, `>=`, or `duration.between(...)` will silently return wrong results or throw at runtime - Cypher's temporal operators do not coerce strings.

---

## HOW IT WORKS (the full lifecycle)

```
Frontend (Date) -- formatLocalDate --> REST endpoint -- date(left(...,10)) --> Neo4j (Date)
       ^                               (DTO validates                              |
       |                                IsDateString)                              |
       +-- new Date(...) <-- convertNeo4jDate <--------------------------------------+
```

### 1. Entity descriptor - the source of truth

```typescript
fields: {
  // Calendar date: stored as Neo4j Date (no time, no zone)
  date:      { type: "date",     required: true },
  due_date:  { type: "date",     required: true },
  paid_on:   { type: "date" },

  // Instant in time: stored as Neo4j DateTime (UTC + offset)
  signed_off_at: { type: "datetime" },
  processed_at:  { type: "datetime" },
}
```

If `type` is wrong, **every other layer goes wrong silently**.

### 2. DTOs - validate the wire format

```typescript
@IsDateString() date: string;       // YYYY-MM-DD or ISO 8601
@IsDateString() signed_off_at: string;
```

### 3. Repository - framework path is automatic, custom paths are not

The standard `create` / `put` / `patch` paths in `AbstractRepository` already emit the correct cast. You do not have to think about it when you go through the framework.

**Custom repository helpers (your own `executeInTransaction` blocks) DO bypass the auto-cast.**

```typescript
// WRONG - stores "2026-05-17" as a String
await this.neo4j.executeInTransaction([{
  query: `MATCH (i:<Entity> {id: $id}) SET i.paid_on = $paid_on`,
  params: { id, paid_on: "2026-05-17" },
}]);

// CORRECT - stores a Neo4j Date
await this.neo4j.executeInTransaction([{
  query: `MATCH (i:<Entity> {id: $id}) SET i.paid_on = date(left($paid_on, 10))`,
  params: { id, paid_on: "2026-05-17" },
}]);

// CORRECT - datetime
await this.neo4j.executeInTransaction([{
  query: `MATCH (i:<Entity> {id: $id}) SET i.processed_at = datetime($processed_at)`,
  params: { id, processed_at: "2026-05-17T14:23:00Z" },
}]);

// For "now", use the Cypher function directly - no parameter
SET i.updatedAt = datetime()
```

### 4. Service - string in, string out, no special handling

```typescript
const todayIso = new Date().toISOString().slice(0, 10);   // "YYYY-MM-DD"
await this.create({ id, date: todayIso, due_date: todayIso, ... });
```

### 5. Frontend interface - type as `Date`

```typescript
export interface ExampleInterface extends ApiDataInterface {
  get date(): Date;
  get due_date(): Date;
  get paid_on(): Date | undefined;
  get processed_at(): Date | undefined;   // datetime fields too
}
```

### 6. Frontend model `rehydrate()` - wire string to Date

```typescript
this._date = data.jsonApi.attributes.date
  ? new Date(data.jsonApi.attributes.date)
  : undefined;
```

### 7. Frontend model `createJsonApi()` - Date to wire string

Date fields (`type: "date"`):

```typescript
import { formatLocalDate } from "@carlonicora/nextjs-jsonapi/core";

createJsonApi(data: ExampleInput) {
  // ...
  if (data.date !== undefined) response.data.attributes.date = formatLocalDate(data.date);
  if (data.due_date !== undefined) response.data.attributes.due_date = formatLocalDate(data.due_date);
  if (data.paid_on !== undefined) response.data.attributes.paid_on = formatLocalDate(data.paid_on);
}
```

Datetime fields (`type: "datetime"`):

```typescript
if (data.processed_at !== undefined) response.data.attributes.processed_at = data.processed_at.toISOString();
```

**Why this matters:** `formatLocalDate` uses local date getters, not `.toISOString()`, to avoid the UTC-shift problem. Always import it from `@carlonicora/nextjs-jsonapi/core` - never re-implement it inline.

---

## DECISION MATRIX - date vs datetime vs string

| The field represents... | Use |
|---|---|
| A calendar day with no time component (invoice date, hire date, birthday, due date) | `type: "date"` |
| A precise instant a thing happened (createdAt, signedOffAt, processedAt) | `type: "datetime"` |
| A short code, label, year ("2026", "Q3", "FY26") | `type: "string"` |
| An ISO-8601-shaped string the user freely edits | **Reconsider** - almost always actually a `"date"` or `"datetime"` |

---

## ANTI-PATTERNS (DO NOT DO)

| Code pattern | Why it's wrong | Fix |
|---|---|---|
| `someDate: { type: "string" }` for a calendar field | Cypher temporal ops won't work | `type: "date"` |
| `SET n.due_date = $due_date` in custom Cypher | Bypasses framework cast; stores a String | `SET n.due_date = date(left($due_date, 10))` |
| `SET n.processed_at = $processed_at` in custom Cypher | Same as above for datetime | `SET n.processed_at = datetime($processed_at)` |
| `response.data.attributes.date = data.date` where `data.date: Date` | JSON.stringify ISO-shifts to UTC, can lose a day | `formatLocalDate(data.date)` |
| `get date(): string` on a frontend interface | Loses `Date` semantics | `get date(): Date` |
| Skipping `new Date(...)` in `rehydrate()` and returning the wire string | Type lie | `new Date(data.jsonApi.attributes.date)` |
| DTO uses `@IsString()` instead of `@IsDateString()` for a date field | Accepts garbage like "yesterday" | `@IsDateString()` |

---

## CHECKPOINT - before merging a change that touches a date field

> 1. Is every date-like field declared with `type: "date"` or `type: "datetime"` in the entity descriptor? If no, **STOP**.
> 2. Does every custom Cypher write to a date/datetime property use `date(left($v, 10))` or `datetime($v)`? If no, **STOP**.
> 3. Does the DTO use `@IsDateString()`? If no, **STOP**.
> 4. Does the frontend interface type the field as `Date`? If no, **STOP**.
> 5. Does `rehydrate()` parse the wire string with `new Date(...)`? If no, **STOP**.
> 6. Does `createJsonApi()` use `formatLocalDate()` (dates) or `.toISOString()` (datetimes)? If no, **STOP**.
