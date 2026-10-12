/**
 * Applies migrations to the integration-test database. Refuses to touch any database
 * that is not clearly a test database.
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL is not set (see .env.example).");
if (testUrl === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL.");

const dbName = new URL(testUrl).pathname.replace(/^\//, "");
if (!/_test$/.test(dbName)) {
  throw new Error(`Refusing to migrate "${dbName}": test database names must end with "_test".`);
}

execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: testUrl },
});
