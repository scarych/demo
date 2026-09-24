# `getCount()` ignores `distinct()` / `distinctOn()` already set on the query

Minimal reproduction for MikroORM 7.2.1 (`@mikro-orm/postgresql`).

`QueryBuilder.getCount()` builds its count from the list query, but decides what to count only
from its own `distinct` argument and `hasToManyJoins()`. De-duplication already set on the query
is not taken into account, which breaks in two ways:

1. **`distinct()` without a to-many join** — `count()` picks `*`, while the `DISTINCT` flag set by
   `distinct()` stays on the query: `select count(distinct *)`. PostgreSQL rejects it with
   `syntax error at or near "*"`. A to-one join does not help; only a to-many join makes
   `count()` switch to the primary key.
2. **`distinctOn(fields)`** — the count branch of the query compiler does not look at
   `distinctOn` at all: `select count(*)` over rows that the list itself de-duplicates. No error,
   just a count larger than `getResultList().length`.

## Run

```bash
npm install
npm run sql      # prints the list SQL and the count SQL — no database connection needed
npm run verify   # runs getCount() against PostgreSQL inside a rolled-back transaction
npm run check    # tsc --noEmit — clean, this is a runtime issue, not a types one
```

`verify` connects to `DATABASE_URL` (default `postgres://postgres:postgres@localhost:5432/postgres`)
and works on temporary tables in a transaction that is rolled back, so nothing is written.

## Expected vs actual

`npm run sql`:

```
--- distinct(), no join ---
list:  select distinct "b".* from "book" as "b"
count: select count(distinct *) as "count" from "book" as "b"
--- distinct() + to-one join ---
list:  select distinct "b".* from "book" as "b" inner join "author" as "a" on "b"."author_id" = "a"."id"
count: select count(distinct *) as "count" from "book" as "b" inner join "author" as "a" on "b"."author_id" = "a"."id"
--- distinct() + to-many join (works) ---
list:  select distinct "a".* from "author" as "a" inner join "book" as "b" on "a"."id" = "b"."author_id"
count: select count(distinct "a"."id") as "count" from "author" as "a" inner join "book" as "b" on "a"."id" = "b"."author_id"
--- distinctOn(['b.author']) ---
list:  select distinct on ("b"."author_id") "b".* from "book" as "b"
count: select count(*) as "count" from "book" as "b"
```

Expected: `count(distinct "b"."id")` for the first two, `count(distinct "b"."author_id")` for the
last one.

`npm run verify` (two authors, three books — `A` has two of them):

```
--- distinct(), no join ---
list rows: 3 | getCount(): failed: syntax error at or near "*"
explicit count: 3
--- distinct() + to-one join ---
list rows: 3 | getCount(): failed: syntax error at or near "*"
explicit count: 3
--- distinct() + to-many join (works) ---
list rows: 2 | getCount(): 2
explicit count: 2
--- distinctOn(['b.author']) ---
list rows: 2 | getCount(): 3   <-- differs from the list
explicit count: 2
```

`explicit count` is the workaround below. Reproduced with 7.2.1, Node.js 24.18.0,
PostgreSQL 18.4; `master` at 8185e4f has the same code.

## Cause

`getCount()` delegates the choice of fields to `count(field, distinct ?? hasToManyJoins())`:

https://github.com/mikro-orm/mikro-orm/blob/8185e4f0a4185139a747ac5a6b32d829bd1694b6/packages/sql/src/query/QueryBuilder.ts#L2807-L2813

`count()` falls back to `*` unless its own `distinct` argument is set or there is a to-many join —
the `DISTINCT` flag that `distinct()` has already put on the query is not consulted here:

https://github.com/mikro-orm/mikro-orm/blob/8185e4f0a4185139a747ac5a6b32d829bd1694b6/packages/sql/src/query/QueryBuilder.ts#L976-L990

The compiler then renders the count with that flag (hence `count(distinct *)`), and — unlike the
`SELECT` branch just above it — never looks at `distinctOn`:

https://github.com/mikro-orm/mikro-orm/blob/8185e4f0a4185139a747ac5a6b32d829bd1694b6/packages/sql/src/query/QueryBuilder.ts#L3559-L3574

## Suggested fix

- In `count()`, treat an already-set `QueryFlag.DISTINCT` like `distinct = true` when choosing
  the fields: count the primary key instead of `*`.
- With `distinctOn`, count the distinct-on fields: `count(distinct "b"."author_id")` for a single
  field (several fields need a row value, `count(distinct ("x", "y"))`), or wrap the query as a
  sub-query: `select count(*) from (<list query>) as "t"`.

## Workaround

Ask for the distinct count explicitly:

```ts
qb.getCount(undefined, true);   // distinct(): count(distinct <primary key>)
qb.getCount('b.author', true);  // distinctOn(['b.author']): count(distinct "b"."author_id")
```

Related: mikro-orm/mikro-orm#3182 — a similar `count(distinct(*))` in 5.1.5, reached through
`count('id', true)` at the time.
