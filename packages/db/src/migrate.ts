import "dotenv/config";

import { parseDatabaseEnv } from "@wickedhostbotai/shared";

import { createDatabaseConnection } from "./client.js";
import { runMigrations } from "./runtime-migrate.js";

async function main(): Promise<void> {
  const env = parseDatabaseEnv(process.env);
  const connection = createDatabaseConnection(env.DATABASE_URL);

  try {
    await runMigrations(connection.db);
    console.log("Database migrations applied.");
  } finally {
    await connection.pool.end();
  }
}

main().catch((error) => {
  console.error("Failed to run migrations.", error);
  process.exitCode = 1;
});
