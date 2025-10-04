// apps/portal/lib/neon.ts
import { neon } from "@neondatabase/serverless";

/**
 * We expose two things:
 *  - getSql(): the native Neon tagged function (if you really want templates)
 *  - exec(text, params[]): a SAFE wrapper that always uses (text, array) form
 *
 * The wrapper avoids the common TS overload gotchas ("Expected 1-3 arguments").
 */

export type Sql = ReturnType<typeof neon>;

let _sql: Sql | null = null;

export function getSql(): Sql {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Missing DATABASE_URL");
  }
  _sql = neon(url);
  return _sql;
}

/**
 * exec: Preferred way to run queries in routes.
 * Always call as: await exec("SQL with $1,$2,...", [param1, param2, ...])
 */
export async function exec<T = unknown>(text: string, params: unknown[] = []): Promise<T[]> {
  // Cast to any to avoid TS overload friction; runtime is correct for neon(text, params[])
  const sql = getSql() as unknown as (t: string, p?: unknown[]) => Promise<T[]>;
  return sql(text, params);
}
