/**
 * Creates a workspace account. There is no public sign-up page, so this is the
 * only way in.
 *
 *   npm run db:user -- you@studio.com "a-strong-password" "Your Name" owner
 *
 * Role is "owner" or "partner" and defaults to partner.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const [email, password, fullName, role = "partner"] = process.argv.slice(2);

if (!email || !password) {
  console.error(
    '\n  Usage: npm run db:user -- <email> <password> ["Full Name"] [owner|partner]\n',
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("\n  NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName ?? email.split("@")[0] },
});

if (error) {
  console.error(`\n  ${error.message}\n`);
  process.exit(1);
}

await admin
  .from("profiles")
  .update({ full_name: fullName ?? email.split("@")[0], role, email })
  .eq("id", data.user.id);

console.log(`\n  Created ${email} as ${role}. They can sign in now.\n`);
