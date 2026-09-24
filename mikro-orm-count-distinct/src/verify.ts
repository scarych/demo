import "reflect-metadata";
import { MikroORM } from "@mikro-orm/postgresql";
import { Author, Book } from "./entities.js";
import { cases } from "./queries.js";

class Rollback extends Error {}

// Runs every case against a real PostgreSQL, inside one rolled-back transaction
// on temporary tables — nothing is written to the target database.
const orm = await MikroORM.init({
  entities: [Author, Book],
  metadataCache: { enabled: false },
  clientUrl: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/postgres",
});

try {
  await orm.em.transactional(async (em) => {
    const run = (query: string) => em.execute(query);
    const [{ server_version }] = await run("show server_version");
    console.log(`PostgreSQL ${server_version}\n`);

    await run(`create temp table author (id int primary key, name text)`);
    await run(`create temp table book (id int primary key, title text, author_id int)`);
    await run(`insert into author values (1, 'A'), (2, 'B')`);
    await run(`insert into book values (1, 'a1', 1), (2, 'a2', 1), (3, 'b1', 2)`);

    for (const { label, build, workaround } of cases(em)) {
      console.log(`--- ${label} ---`);
      const rows = (await build().getResultList()).length;
      // a failed statement aborts the whole transaction, so isolate the call
      await run(`savepoint c`);
      let count: string;
      try {
        count = String(await build().getCount());
        await run(`release savepoint c`);
      } catch (e) {
        count = `failed: ${(e as Error).message.split("\n").pop()}`;
        await run(`rollback to savepoint c`);
      }
      const differs = count !== String(rows) && !count.startsWith("failed");
      const flag = differs ? "   <-- differs from the list" : "";
      console.log(`list rows: ${rows} | getCount(): ${count}${flag}`);
      console.log(`explicit count: ${await workaround(build())}`);
    }

    throw new Rollback();
  });
} catch (e) {
  if (!(e instanceof Rollback)) {
    throw e;
  }
}

await orm.close(true);
