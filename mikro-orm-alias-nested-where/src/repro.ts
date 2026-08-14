import type { MikroORM } from "@mikro-orm/postgresql";
import { Author } from "./entities.js";

// no runtime needed — this file only has to be type-checked
declare const orm: MikroORM;

const qb = orm.em.createQueryBuilder(Author, "a").leftJoin("a.books", "b");

// OK — alias-prefixed keys at the top level
qb.where({ "a.name": "x", "b.title": "y" });

// OK — alias-prefixed keys inside a single group operator
qb.where({ $and: [{ "a.name": "x" }, { "b.title": "y" }] });
qb.where({ $or: [{ "a.name": "x" }, { "b.title": "y" }] });

// ERROR TS2769 — root alias one level deeper
qb.where({ $or: [{ $and: [{ "a.name": "x" }] }] });

// ERROR TS2769 — join alias one level deeper
qb.where({ $and: [{ $or: [{ "b.title": "y" }] }] });

// OK — the very same nesting with non-prefixed keys
qb.where({ $or: [{ $and: [{ name: "x" }] }] });
