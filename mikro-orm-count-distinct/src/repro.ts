import "reflect-metadata";
import { MikroORM } from "@mikro-orm/postgresql";
import { Author, Book } from "./entities.js";
import { cases } from "./queries.js";

// SQL generation only — no database connection needed
const orm = await MikroORM.init({
  entities: [Author, Book],
  metadataCache: { enabled: false },
  dbName: "repro",
});

const em = orm.em.fork();

// getCount() runs clone().count(undefined, hasToManyJoins()). Without a to-many join that is
// exactly count(); with one, count() picks the primary key as well — the SQL is the same
for (const { label, build } of cases(em)) {
  console.log(`--- ${label} ---`);
  console.log("list: ", build().getFormattedQuery());
  console.log("count:", build().count().getFormattedQuery());
}

await orm.close(true);
