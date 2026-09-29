# Bun collects a Symbol that is still reachable as a property key

Minimal reproduction for Bun 1.4.2 (`1.4.2+744846f84`, macOS arm64). Node 24.18.0 is not affected.

A Symbol that is reachable only as a property key of a live object (`{ [symbol]: value }`) is
treated as dead by the garbage collector:

- `WeakMap` entries keyed by it are removed;
- `WeakRef`s to it are cleared (`deref()` returns `undefined`),

although `Object.getOwnPropertySymbols(object)` still returns that symbol. The symbol can still be
reached from the object, so it is live, and both must be kept — Node keeps them. Keeping the symbol
in an array as well (the control case) makes the problem disappear.

## Run

```bash
bun repro.mjs                   # no dependencies
node --expose-gc repro.mjs      # for comparison

bun install                     # only for the MikroORM part
bun mikro-orm.mjs               # the same bug through MikroORM 7 raw() keys
node --expose-gc mikro-orm.mjs
```

## Expected vs actual

`bun repro.mjs`:

```
Bun 1.4.2
symbol reachable only as a property key: WeakMap entry lost 135/200, WeakRef cleared 135/200
symbol also held in an array (control):  WeakMap entry lost 0/200, WeakRef cleared 0/200
```

`node --expose-gc repro.mjs`:

```
Node v24.18.0
symbol reachable only as a property key: WeakMap entry lost 0/200, WeakRef cleared 0/200
symbol also held in an array (control):  WeakMap entry lost 0/200, WeakRef cleared 0/200
```

Expected in Bun: `0/200` in both lines, as in Node. The count varies from run to run. `scrub()`
overwrites stale stack slots so that a conservative stack scan does not keep the symbol alive by
accident; without it the loss still shows, less often (96/200 in one run).

## Why it matters: MikroORM `raw()` keys

MikroORM 7 accepts a raw SQL fragment as a condition key: `{ [raw("lower(title)")]: "dune" }`.
Used as a property key, the fragment turns into a Symbol, and MikroORM finds the fragment by that
Symbol in a global `WeakMap` (`RawQueryFragment` in `@mikro-orm/core`). Under Bun, once a GC runs
between building the condition and compiling the query, the entry is gone, MikroORM no longer
recognises the key, and the condition silently disappears from the SQL: a query meant to be
filtered returns every row.

`bun mikro-orm.mjs`:

```
Bun 1.4.2
expected: select "b".* from "book" as "b" where lower(title) = 'dune'
condition dropped from WHERE in 50 of 50 runs: select "b".* from "book" as "b"
```

`node --expose-gc mikro-orm.mjs`:

```
Node v24.18.0
expected: select "b".* from "book" as "b" where lower(title) = 'dune'
condition dropped from WHERE in 0 of 50 runs
```

Without a forced GC the loss is rare but real: about one condition in 5 000 in a loop that builds
such queries. `QueryBuilder.where()` re-creates the fragments internally, so keeping your own
reference to the fragment does not close the window between `where()` and SQL generation.

Workaround until this is fixed: keep every fragment strongly referenced for a while (a fragment
holds its own symbol), e.g. by wrapping `set` of the registry MikroORM shares through
`globalThis[Symbol.for("@mikro-orm/core/RawQueryFragment.references")]`.
