import "reflect-metadata";
import { MikroORM } from "@mikro-orm/postgresql";
import { Author, Book } from "./entities.js";

// the runtime builds the rejected condition just fine — no database connection needed
const orm = await MikroORM.init({
  entities: [Author, Book],
  metadataCache: { enabled: false },
  dbName: "repro",
  connect: false,
});

const qb = orm.em.createQueryBuilder(Author, "a").leftJoin("a.books", "b");

qb.where({ $or: [{ $and: [{ "a.name": "x" }] }, { $and: [{ "b.title": "y" }] }] } as any);

console.log(qb.getFormattedQuery());

await orm.close(true);
