# `join()` cannot reference a CTE by name — raw table references are always wrapped in parentheses

Minimal reproduction for MikroORM 7.1.11 (`@mikro-orm/postgresql`).

`from()` can reference a CTE or a raw table by name (`fromRawTable()`, plus the CTE-registry lookup
added in mikro-orm/mikro-orm#7523). `join()` has no equivalent: every non-string argument is routed
into the `__subquery__` branch of `joinReference()` and rendered as `(<sql>) as "alias"`, so a raw
identifier — `sql.ref('employee_tree')` — produces invalid SQL.

This is most visible with `withRecursive()`, where the recursive term must reference the CTE itself
and there is no supported way to express that.

## Run

```bash
npm install
npm run check    # tsc --noEmit — passes, this is a runtime-only issue
npm run sql      # prints both queries, no database needed
npm run verify   # executes both against PostgreSQL (see below)
```

`npm run verify` needs a reachable PostgreSQL; point it at one with `DATABASE_URL`, e.g.

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run verify
```

It runs everything inside a single rolled-back transaction on a temporary table, so nothing is
written to the target database.

## Expected vs actual

[src/queries.ts](src/queries.ts) builds a recursive CTE that walks an employee tree downwards. The
recursive term joins the CTE back onto `employee`:

```ts
em.createQueryBuilder(Employee, "e")
  .select("e.*")
  .join(sql.ref(CTE), "tree", { "tree.id": sql.ref("e.manager_id") });
```

`npm run sql` emits:

```sql
with recursive "employee_tree" as (
  (select "root".* from "employee" as "root" where "root"."id" = 1)
  union all
  (select "e".* from "employee" as "e"
     inner join ("employee_tree") as "tree" on "tree"."id" = "e"."manager_id")
)
select "tree"."id" from "employee_tree" as "tree"
```

The join should read `inner join "employee_tree" as "tree"`. As emitted, PostgreSQL rejects it —
`npm run verify` prints:

```
--- join(sql.ref(cte)) ---
failed: syntax error at or near ")"
--- join(raw('select * from ??', [cte])) ---
ok: [{"id":1},{"id":2},{"id":3}]
```

Reproduced with TypeScript 7.0.2, Node.js 24.18.0, PostgreSQL 18.4.

## Cause

`QueryBuilder.joinReference()` turns any `typeof field === 'object'` into a `__subquery__` join:

https://github.com/mikro-orm/mikro-orm/blob/master/packages/sql/src/query/QueryBuilder.ts

```js
if (isRaw(field)) {
    field = this.platform.formatQuery(field.sql, field.params);
}
...
this.#state.joins[key] = { prop, alias, type, cond, schema, subquery: field.toString(), ... };
```

`QueryBuilderHelper.createJoinExpression()` then wraps it unconditionally:

```js
else if (join.subquery) {
    const asKeyword = this.#platform.usesAsKeyword() ? ' as ' : ' ';
    sql += `(${join.subquery})${asKeyword}${this.#platform.quoteIdentifier(join.alias)}`;
}
```

The CTE registry cannot help here either: `withRecursive()` is called on the outer builder, while the
recursive term is compiled independently through `unionAll()` → `toQuery()` and never sees it.

## Workaround

Pass a real sub-query, so the mandatory parentheses become valid SQL:

```ts
.join(raw("select * from ??", [CTE]), "tree", { "tree.id": sql.ref("e.manager_id") });
// -> inner join (select * from "employee_tree") as "tree" on ...
```

PostgreSQL accepts this inside a recursive term and flattens it, so the result is correct — it is
just noise in the emitted SQL.
