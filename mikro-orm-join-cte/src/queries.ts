import { raw, sql } from "@mikro-orm/core";
import type { QueryBuilder, SqlEntityManager } from "@mikro-orm/postgresql";
import { Employee } from "./entities.js";

export const CTE = "employee_tree";

/** Non-recursive term: start from a single root employee. */
function anchor(em: SqlEntityManager) {
  return em.createQueryBuilder(Employee, "root").select("root.*").where({ id: 1 });
}

/** Outer query: read the whole tree back out of the CTE. */
function wrap(em: SqlEntityManager, recursiveTerm: QueryBuilder<any>) {
  return em
    .createQueryBuilder(Employee)
    .withRecursive(CTE, anchor(em).unionAll(recursiveTerm))
    .select("id")
    .from(CTE, "tree");
}

/**
 * What you would expect to write: reference the CTE by name in the recursive term.
 * `join()` renders every raw argument as a sub-query, so this emits `("employee_tree") as "tree"`.
 */
export function broken(em: SqlEntityManager) {
  const recursiveTerm = em
    .createQueryBuilder(Employee, "e")
    .select("e.*")
    .join(sql.ref(CTE), "tree", { "tree.id": sql.ref("e.manager_id") });

  return wrap(em, recursiveTerm).getFormattedQuery();
}

/** Workaround: pass a real sub-query, so the mandatory parentheses become valid SQL. */
export function workaround(em: SqlEntityManager) {
  const recursiveTerm = em
    .createQueryBuilder(Employee, "e")
    .select("e.*")
    .join(raw("select * from ??", [CTE]), "tree", { "tree.id": sql.ref("e.manager_id") });

  return wrap(em, recursiveTerm).getFormattedQuery();
}
