import "reflect-metadata";
import { MikroORM } from "@mikro-orm/postgresql";
import { Author, Book } from "./entities.js";

// no database connection needed — the SQL is built, not executed
const orm = await MikroORM.init({
  entities: [Author, Book],
  metadataCache: { enabled: false },
  dbName: "repro",
});

const em = orm.em.fork();
const qb = () => em.createQueryBuilder(Book, "b").select("b.*").leftJoin("b.author", "a");

const show = (label: string, build: () => string) => {
  console.log(`\n### ${label}`);
  try {
    console.log("   ", build());
  } catch (e: any) {
    console.log("    throws:", e.message.split("\n")[0]);
  }
};

// control — a scalar property of the same joined entity resolves the alias correctly
show("scalar property, aliased key — OK", () =>
  qb().where({ "a.active": true }).getFormattedQuery(),
);

// 1) JSON path — the alias "a" is silently replaced with the root alias "b",
//    which produces invalid SQL: the `book` table has no `meta` column
//    actual:   where "b"."meta"->>'tag' = 'x'
//    expected: where "a"."meta"->>'tag' = 'x'
show("JSON path, aliased key — WRONG ALIAS", () =>
  qb().where({ "a.meta": { tag: "x" } }).getFormattedQuery(),
);

// 2) $contains — the alias is dropped entirely and the column name is then
//    resolved against the root entity
//    throws: Trying to query by not existing property Book.meta
show("JSON $contains, aliased key — THROWS", () =>
  qb().where({ "a.meta": { $contains: [{ tag: "x" }] } }).getFormattedQuery(),
);

// 3) $elemMatch — same cause, the inner key is resolved against the root entity
//    throws: Trying to query by not existing property Book.tag
show("JSON $elemMatch, aliased key — THROWS", () =>
  // `$elemMatch` under an alias-prefixed key is not in `QBFilterQuery` either, hence the cast
  qb().where({ "a.meta": { $elemMatch: { tag: "x" } } } as any).getFormattedQuery(),
);

// counterexample — the same conditions expressed through the relation, so that the
// alias is carried by the criteria node instead of the key, are built correctly
show("JSON path via relation — OK", () =>
  em.createQueryBuilder(Book, "b").select("b.*")
    .where({ author: { meta: { tag: "x" } } }).getFormattedQuery(),
);

show("JSON $elemMatch via relation — OK", () =>
  em.createQueryBuilder(Book, "b").select("b.*")
    .where({ author: { meta: { $elemMatch: { tag: "x" } } } }).getFormattedQuery(),
);

await orm.close(true);
