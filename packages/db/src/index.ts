export * from "./client.js";
export * from "./runtime-migrate.js";
export * from "./schema.js";

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
