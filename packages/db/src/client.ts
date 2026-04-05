import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema.js";

export type Database = NodePgDatabase<typeof schema>;

export interface DatabaseConnection {
  pool: Pool;
  db: Database;
}

export function createDatabaseConnection(
  connectionString: string,
): DatabaseConnection {
  const pool = new Pool({
    connectionString,
    max: 10,
  });

  return {
    pool,
    db: drizzle(pool, { schema }),
  };
}

export async function checkDatabaseHealth(pool: Pool): Promise<{
  ok: boolean;
  detail?: string;
}> {
  try {
    await pool.query("select 1");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}
