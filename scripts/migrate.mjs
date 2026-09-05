/**
 * Applies every SQL file in supabase/migrations, in order.
 *
 *   npm run db:push
 *
 * Needs SUPABASE_DB_URL in .env.local — the direct Postgres connection string
 * from Supabase (Project Settings -> Database -> Connection string -> URI).
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("\n  SUPABASE_DB_URL is not set in .env.local.\n");
  process.exit(1);
}

const dir = join(process.cwd(), "supabase", "migrations");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

if (files.length === 0) {
  console.error("  No .sql files in supabase/migrations.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log(`\n  Connected. Applying ${files.length} migration(s).\n`);

for (const file of files) {
  const sql = await readFile(join(dir, file), "utf8");
  process.stdout.write(`  ${file} … `);
  try {
    await client.query(sql);
    console.log("ok");
  } catch (error) {
    console.log("failed");
    console.error(`\n  ${error.message}\n`);
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log("\n  Schema is up to date.\n");
