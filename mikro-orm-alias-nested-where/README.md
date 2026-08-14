# QueryBuilder types reject alias-prefixed keys inside nested `$and`/`$or` groups

Minimal reproduction for MikroORM 7.1.11 (`@mikro-orm/postgresql`).

`QBFilterQuery` accepts alias-prefixed keys (the root alias and join context aliases) at the top
level of `where()` and inside a single group operator, but not one level deeper: as soon as a group
operator is nested inside another group operator, alias keys are rejected. The runtime builds such a
condition without any problem, so this is a types-only issue.

## Run

```bash
npm install
npm run check   # tsc --noEmit — fails on exactly two lines of src/repro.ts
npm run sql     # builds the rejected condition at runtime and prints the SQL
```

## Expected vs actual

`npm run check` reports errors only for the two marked lines in [src/repro.ts](src/repro.ts):

```
src/repro.ts(17,12): error TS2769: No overload matches this call.
src/repro.ts(20,12): error TS2769: No overload matches this call.
```

Both should type-check: `npm run sql` builds the very same condition and produces the expected SQL:

```sql
select "a".* from "author" as "a"
left join "book" as "b" on "a"."id" = "b"."author_id"
where (("a"."name" = 'x') or ("b"."title" = 'y'))
```

Reproduced with TypeScript 7.0.2 and 6.0.3, Node.js 24.18.0.

## Cause

Elements of `$and` / `$or` / `$not` are typed as `NestedFilterCondition`, which carries
`RootAliasFilterKeys` / `ContextFilterKeys` but not `GroupOperators` itself, so a nested
`$and` / `$or` key can only be resolved through `ObjectQuery<Entity>` — non-prefixed entity keys only:

https://github.com/mikro-orm/mikro-orm/blob/master/packages/sql/src/query/QueryBuilder.ts#L493-L505

The diagnostic is misleading too: once the object overload fails, TypeScript falls back to the raw SQL
overload, so the last line of the error mentions `RawQueryFragment` instead of the actual problem.
