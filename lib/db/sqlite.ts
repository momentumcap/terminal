import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { sqliteSchema } from "@/lib/db/schema";

let db: DatabaseSync | null = null;

export function getDatabasePath() {
  if (process.env.SQLITE_PATH) return process.env.SQLITE_PATH;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join("/tmp", "momentum.sqlite");
  }
  return path.join(process.cwd(), "data", "momentum.sqlite");
}

export function getDatabase() {
  if (db) return db;
  const databasePath = getDatabasePath();
  mkdirSync(path.dirname(databasePath), { recursive: true });
  db = new DatabaseSync(databasePath);
  db.exec("pragma journal_mode = WAL;");
  db.exec("pragma busy_timeout = 5000;");
  db.exec(sqliteSchema);
  return db;
}

export function closeDatabaseForTests() {
  db?.close();
  db = null;
}
