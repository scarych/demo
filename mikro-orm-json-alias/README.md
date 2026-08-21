# `where` on a JSON property of a joined entity ignores the join alias

Minimal reproduction for MikroORM 7.1.13 (`@mikro-orm/postgresql`).

A condition addressed by an explicit join alias resolves that alias correctly for scalar
properties, but not for JSON ones: for a JSON property the alias segment of the key is dropped,
and the rendered SQL falls back to the **root alias** of the `QueryBuilder`.

## Run

```bash
npm install
npm run sql     # builds the queries and prints the SQL — no database connection needed
npm run check   # tsc --noEmit — clean, this is a runtime issue, not a types one
```

## Expected vs actual

`Author.meta` is a JSON column; `Book` has no `meta` column at all. Both queries below join
`author` as `a`, so both conditions belong to that alias:

```ts
qb.where({ 'a.active': true })       // scalar   → where "a"."active" = true            ✔
qb.where({ 'a.meta': { tag: 'x' } }) // JSON     → where "b"."meta"->>'tag' = 'x'        ✘
```

Expected for the second one:

```sql
where "a"."meta"->>'tag' = 'x'
```

The alias is not merely cosmetic here — the generated SQL is invalid, since `meta` only exists on
`author`. Postgres rejects it with `column b.meta does not exist`.

Two more conditions on the same key fail earlier, while resolving the property:

```ts
qb.where({ 'a.meta': { $contains: [{ tag: 'x' }] } })   // Trying to query by not existing property Book.meta
qb.where({ 'a.meta': { $elemMatch: { tag: 'x' } } })    // Trying to query by not existing property Book.tag
```

Expressing the same conditions through the relation, so that the alias is carried by the criteria
node rather than by the key, works as expected — MikroORM joins the entity itself as `a1` and
qualifies the JSON column with it:

```sql
where "a1"."meta"->>'tag' = 'x'
where exists (select 1 from jsonb_array_elements("a1"."meta") as "__je0" where "__je0"->>'tag' = 'x')
```

Reproduced with 7.1.13 and 7.1.14-dev.2, Node.js 24.18.0, PostgreSQL 18.

## Cause

`QueryHelper.processWhere()` resolves the property through `findProperty()`, which does take the
alias into account (`parts.pop()` / `aliasMap[alias]`), but the JSON branch then passes only the
column name on, dropping the alias segment of the key:

https://github.com/mikro-orm/mikro-orm/blob/3bc4ba7ee9b34bfddcbc63c4caf1a09fe3cbe36b/packages/core/src/utils/QueryHelper.ts#L341-L349

`BasePostgreSqlPlatform.getSearchJsonPropertyKey()` therefore has nothing but a boolean to work
with and emits the `ALIAS_REPLACEMENT` placeholder:

https://github.com/mikro-orm/mikro-orm/blob/3bc4ba7ee9b34bfddcbc63c4caf1a09fe3cbe36b/packages/sql/src/dialects/postgresql/BasePostgreSqlPlatform.ts#L401-L409

and `QueryBuilderHelper.replaceAliases()` substitutes it with the query's root alias:

https://github.com/mikro-orm/mikro-orm/blob/3bc4ba7ee9b34bfddcbc63c4caf1a09fe3cbe36b/packages/sql/src/query/QueryBuilderHelper.ts#L112-L116

The `$contains` and `$elemMatch` variants come from the same place: with the alias gone,
`processJsonCondition()` puts an unqualified key back into the condition object, which is then
resolved against the root entity.

Passing the alias segment of the key through instead of the `aliased` boolean, and using it in
`getSearchJsonPropertyKey()` in place of the placeholder, produces the expected SQL for the first
case and leaves the relation-based ones unchanged.
