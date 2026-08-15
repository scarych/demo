import "reflect-metadata";
import { MikroORM } from "@mikro-orm/postgresql";
import { Employee } from "./entities.js";
import { broken, workaround } from "./queries.js";

class Rollback extends Error {}

// Executes both queries against a real PostgreSQL, inside one rolled-back transaction
// on a temporary table — nothing is written to the target database.
const orm = await MikroORM.init({
  entities: [Employee],
  metadataCache: { enabled: false },
  clientUrl: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/postgres",
});

const em = orm.em.fork();
const conn = orm.em.getConnection();

try {
  await conn.transactional(async (trx) => {
    const run = (query: string) => conn.execute(query, [], "run", trx);

    await run(`create temp table employee (id int primary key, name text, manager_id int)`);
    await run(`insert into employee values (1, 'root', null), (2, 'a', 1), (3, 'b', 2), (4, 'x', null)`);

    const cases = [
      ["join(sql.ref(cte))", broken(em)],
      ["join(raw('select * from ??', [cte]))", workaround(em)],
    ] as const;

    for (const [label, query] of cases) {
      console.log(`--- ${label} ---`);
      // a failed statement aborts the whole transaction, so isolate each case
      await run(`savepoint c`);
      try {
        console.log("ok:", JSON.stringify(await conn.execute(query, [], "all", trx)));
        await run(`release savepoint c`);
      } catch (e) {
        console.log("failed:", (e as Error).message.split("\n")[0]);
        await run(`rollback to savepoint c`);
      }
    }

    throw new Rollback();
  });
} catch (e) {
  if (!(e instanceof Rollback)) {
    throw e;
  }
}

await orm.close(true);
