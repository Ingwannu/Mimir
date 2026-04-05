import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Database } from "./client.js";

export async function runMigrations(
  db: Database,
  migrationsFolder?: string,
): Promise<void> {
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const currentDir = dirname(fileURLToPath(import.meta.url));

  await migrate(db, {
    migrationsFolder: migrationsFolder ?? resolve(currentDir, "../drizzle"),
  });
}
