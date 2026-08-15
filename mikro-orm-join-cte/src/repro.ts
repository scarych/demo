import "reflect-metadata";
import { MikroORM } from "@mikro-orm/postgresql";
import { Employee } from "./entities.js";
import { broken, workaround } from "./queries.js";

// SQL generation only — no database connection needed
const orm = await MikroORM.init({
  entities: [Employee],
  metadataCache: { enabled: false },
  dbName: "repro",
});

const em = orm.em.fork();

console.log("--- join(sql.ref(cte)) — invalid SQL ---");
console.log(broken(em));
console.log("\n--- join(raw('select * from ??', [cte])) — workaround ---");
console.log(workaround(em));

await orm.close(true);
