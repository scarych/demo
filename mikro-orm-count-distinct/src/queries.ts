import type { QueryBuilder, SqlEntityManager } from "@mikro-orm/postgresql";
import { Author, Book } from "./entities.js";

type Case = {
  label: string;
  /** a fresh builder every time: getCount() and getResultList() are called on separate ones */
  build: () => QueryBuilder<any, any>;
  /** the same count, asked for explicitly — what getCount() should arrive at on its own */
  workaround: (qb: QueryBuilder<any, any>) => Promise<number>;
};

export function cases(em: SqlEntityManager): Case[] {
  return [
    {
      label: "distinct(), no join",
      build: () => em.createQueryBuilder(Book, "b").select("b.*").distinct(),
      workaround: (qb) => qb.getCount(undefined, true),
    },
    {
      label: "distinct() + to-one join",
      build: () =>
        em.createQueryBuilder(Book, "b").select("b.*").distinct().join("b.author", "a"),
      workaround: (qb) => qb.getCount(undefined, true),
    },
    {
      label: "distinct() + to-many join (works)",
      build: () =>
        em.createQueryBuilder(Author, "a").select("a.*").distinct().join("a.books", "b"),
      workaround: (qb) => qb.getCount(undefined, true),
    },
    {
      label: "distinctOn(['b.author'])",
      build: () => em.createQueryBuilder(Book, "b").select("b.*").distinctOn(["b.author"]),
      workaround: (qb) => qb.getCount("b.author", true),
    },
  ];
}
