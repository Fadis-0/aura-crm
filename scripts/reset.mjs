/**
 * Empties the workspace: every record goes, both accounts stay.
 *
 *   npm run db:reset
 *
 * Ask before running. There is no undo.
 */
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", quiet: true });

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("\n  SUPABASE_DB_URL is not set in .env.local.\n");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
await client.query(`
  truncate table
    public.activities, public.commissions, public.invoices, public.interactions,
    public.messages, public.conversation_members, public.conversations,
    public.subtasks, public.tasks, public.board_columns, public.boards,
    public.notes, public.goals, public.events, public.projects,
    public.clients, public.leads, public.affiliates
  restart identity cascade`);
await client.end();

console.log("\n  Workspace emptied. Accounts and profiles kept.\n");
