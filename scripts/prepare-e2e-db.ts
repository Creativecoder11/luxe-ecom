/**
 * Prepares the dedicated E2E database: applies migrations, empties all app tables and seeds
 * synthetic data. Refuses any database whose name does not end with "_e2e".
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const url = process.env.E2E_DATABASE_URL;
if (!url) throw new Error("E2E_DATABASE_URL is not set (see .env.example).");
const dbName = new URL(url).pathname.replace(/^\//, "");
if (!/_e2e$/.test(dbName)) throw new Error(`Refusing to prepare "${dbName}": E2E database names must end with "_e2e".`);

const env = { ...process.env, DATABASE_URL: url, APP_ENV: "test" };
execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], { stdio: "inherit", env });

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const tables = await prisma.$queryRaw<{ tablename: string }[]>`
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
if (tables.length > 0) {
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
}
await prisma.$disconnect();

execFileSync("pnpm", ["exec", "tsx", "prisma/seed.ts"], { stdio: "inherit", env });
execFileSync("pnpm", ["exec", "tsx", "--conditions=react-server", "prisma/seed-catalog.ts"], { stdio: "inherit", env });
