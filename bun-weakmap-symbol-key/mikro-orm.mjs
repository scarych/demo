// The same bug through MikroORM 7: a raw() key is a Symbol, and MikroORM looks the SQL fragment
// up by that Symbol in a WeakMap. After a GC the entry is gone, the key is no longer recognised,
// and the condition silently disappears from the WHERE clause.
import { EntitySchema, MikroORM, raw } from "@mikro-orm/postgresql";

const gc = globalThis.Bun ? () => Bun.gc(true) : globalThis.gc;
if (!gc) throw new Error("Node: run with --expose-gc");
const scrub = (depth) => (depth > 0 ? scrub(depth - 1) + depth : 0);

const Book = new EntitySchema({
  name: "Book",
  properties: { id: { type: "number", primary: true }, title: { type: "string" } },
});

// SQL generation only — no database connection needed
const orm = await MikroORM.init({ entities: [Book], dbName: "repro", metadataCache: { enabled: false } });
const sqlOf = (where) => orm.em.fork().createQueryBuilder(Book, "b").where(where).getFormattedQuery();

const makeWhere = () => ({ [raw("lower(title)")]: "dune" });

console.log(globalThis.Bun ? `Bun ${Bun.version}` : `Node ${process.version}`);
console.log(`expected: ${sqlOf(makeWhere())}`);

const runs = 50;
let dropped = 0;
let actual = "";
for (let i = 0; i < runs; i++) {
  const where = makeWhere();
  scrub(100);
  gc();
  const sql = sqlOf(where);
  if (!sql.includes(" where ")) {
    dropped++;
    actual = sql;
  }
}
console.log(`condition dropped from WHERE in ${dropped} of ${runs} runs${actual ? `: ${actual}` : ""}`);

await orm.close(true);
