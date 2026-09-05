/**
 * Creates the two workspace accounts. Both are owners with equal standing.
 *
 *   npm run db:seed            accounts only, empty workspace
 *   npm run db:seed -- --demo  also fills the app with sample records
 *
 * Reads OWNER_* and CO_OWNER_* from .env.local. Safe to re-run: existing
 * accounts are reused and their profiles updated, and --demo only adds sample
 * rows to an empty database.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("\n  NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.\n");
  process.exit(1);
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const at = (offsetDays, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const monthsAgo = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n, 12);
  return d.toISOString().slice(0, 10);
};

/**
 * Insert one row at a time and fail loudly.
 *
 * Row by row on purpose: in a multi-row insert PostgREST unions the keys and
 * sends an explicit NULL for any key a row omits, which blows past the column
 * default and trips every NOT NULL. One row per request keeps the sample data
 * readable — a row only lists what it actually overrides.
 */
async function insert(table, rows, columns) {
  const list = Array.isArray(rows) ? rows : [rows];
  const out = [];

  for (const row of list) {
    const query = db.from(table).insert(row);
    const { data, error } = columns ? await query.select(columns) : await query;
    if (error) {
      console.error(`\n  Insert into ${table} failed: ${error.message}`);
      if (error.details) console.error(`  ${error.details}`);
      process.exit(1);
    }
    if (data) out.push(...data);
  }

  return out;
}

/* ----------------------------------------------------------- accounts -- */

async function ensureUser(email, password, fullName, role, accent) {
  if (!email || !password) return null;

  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email === email);

  let id = existing?.id;
  if (!id) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) {
      console.error(`  Could not create ${email}: ${error.message}`);
      return null;
    }
    id = data.user.id;
    console.log(`  Created account ${email}`);
  } else {
    console.log(`  Account ${email} already exists`);
  }

  await db
    .from("profiles")
    .upsert({ id, full_name: fullName, email, role, accent }, { onConflict: "id" });

  return id;
}

const owner = await ensureUser(
  process.env.OWNER_EMAIL,
  process.env.OWNER_PASSWORD,
  process.env.OWNER_NAME ?? "Owner",
  "owner",
  "clay",
);

const coOwner = await ensureUser(
  process.env.CO_OWNER_EMAIL,
  process.env.CO_OWNER_PASSWORD,
  process.env.CO_OWNER_NAME ?? "Co-owner",
  "owner",
  "plum",
);

if (!owner) {
  console.error("\n  Set OWNER_EMAIL and OWNER_PASSWORD in .env.local, then run again.\n");
  process.exit(1);
}

/* --------------------------------------------------------- sample data -- */

if (!process.argv.includes("--demo")) {
  console.log(
    "\n  Workspace ready and empty." +
      "\n  Run `npm run db:seed -- --demo` if you want sample records to look at.\n",
  );
  process.exit(0);
}

const { count: clientCount } = await db
  .from("clients")
  .select("id", { count: "exact", head: true });

if (clientCount && clientCount > 0) {
  console.log("\n  Data already present, skipping sample rows.\n");
  process.exit(0);
}

console.log("  Adding sample data…");

const affiliates = await insert("affiliates", [
    {
      name: "Nadia Berrada",
      company: "Casablanca Creative",
      email: "nadia@casacreative.ma",
      commission_rate: 15,
      accent: "indigo",
      payout_method: "Bank transfer",
      notes: "Sends design-led ecommerce work. Prefers a monthly summary.",
      joined_at: monthsAgo(8),
    },
    {
      name: "Tom Whitfield",
      company: "Whitfield Consulting",
      email: "tom@whitfield.co",
      commission_rate: 10,
      accent: "sage",
      payout_method: "PayPal",
      notes: "Enterprise intros. Slow but large deals.",
      joined_at: monthsAgo(14),
    },
    {
      name: "Salma Idrissi",
      email: "salma.idrissi@gmail.com",
      commission_rate: 12,
      accent: "amber",
      status: "active",
      payout_method: "Wise",
      joined_at: monthsAgo(3),
    },
], "id,name,commission_rate");

const aff = (name) => affiliates?.find((a) => a.name.startsWith(name))?.id ?? null;

const clients = await insert("clients", [
    {
      name: "Amine Tazi",
      company: "Terrace Coffee Roasters",
      email: "amine@terraceroasters.com",
      phone: "+212 661 22 44 88",
      website: "https://terraceroasters.com",
      country: "Morocco",
      status: "active",
      health: "good",
      tier: "key",
      source: "affiliate",
      affiliate_id: aff("Nadia"),
      lifetime_value: 5000000,
      retainer_amount: 290000,
      accent: "clay",
      tags: ["ecommerce", "brand"],
      since: monthsAgo(11),
      notes: "Roastery expanding to three cities. Wants the shop rebuilt before Ramadan.",
    },
    {
      name: "Clara Nunes",
      company: "Vela Studio",
      email: "clara@velastudio.pt",
      country: "Portugal",
      status: "active",
      health: "watch",
      tier: "standard",
      source: "referral",
      lifetime_value: 2100000,
      retainer_amount: 120000,
      accent: "plum",
      tags: ["design", "retainer"],
      since: monthsAgo(6),
      notes: "Slow to reply lately. Check in before the retainer renews.",
    },
    {
      name: "Jonas Weber",
      company: "Nordwind Logistics",
      email: "j.weber@nordwind.de",
      country: "Germany",
      status: "active",
      health: "good",
      tier: "strategic",
      source: "affiliate",
      affiliate_id: aff("Tom"),
      lifetime_value: 9600000,
      retainer_amount: 580000,
      accent: "indigo",
      tags: ["saas", "dashboard"],
      since: monthsAgo(19),
    },
    {
      name: "Yara Haddad",
      company: "Olive & Thread",
      email: "yara@oliveandthread.com",
      status: "paused",
      health: "at_risk",
      source: "inbound",
      lifetime_value: 1200000,
      accent: "amber",
      tags: ["retail"],
      since: monthsAgo(4),
      notes: "Paused while they raise. Revisit in the spring.",
    },
], "id,name,affiliate_id");

const client = (name) => clients?.find((c) => c.name.startsWith(name))?.id ?? null;

await insert("leads", [
  {
    name: "Karim Belhaj",
    company: "Atlas Outdoor",
    email: "karim@atlasoutdoor.ma",
    stage: "negotiation",
    temperature: "hot",
    source: "affiliate",
    affiliate_id: aff("Nadia"),
    estimated_value: 3100000,
    probability: 70,
    expected_close: day(18),
    tags: ["ecommerce"],
    notes: "Wants a full rebuild plus a booking flow. Budget confirmed, waiting on their board.",
    last_contact_at: at(-2, 15),
  },
  {
    name: "Elena Petrova",
    company: "Bright Path Learning",
    email: "elena@brightpath.io",
    stage: "proposal",
    temperature: "warm",
    source: "inbound",
    estimated_value: 2000000,
    probability: 45,
    expected_close: day(30),
    notes: "Sent the proposal Tuesday. Follow up Friday if quiet.",
    last_contact_at: at(-5, 11),
  },
  {
    name: "Marc Dubois",
    company: "Coteau Vineyards",
    email: "marc@coteau.fr",
    stage: "qualified",
    temperature: "warm",
    source: "referral",
    estimated_value: 1300000,
    probability: 35,
    expected_close: day(45),
  },
  {
    name: "Priya Raman",
    company: "Sunder Textiles",
    stage: "contacted",
    temperature: "cold",
    source: "outbound",
    estimated_value: 840000,
    probability: 15,
  },
  {
    name: "Owen Fletcher",
    company: "Harbour Fitness",
    email: "owen@harbourfit.co.uk",
    stage: "new",
    temperature: "warm",
    source: "affiliate",
    affiliate_id: aff("Salma"),
    estimated_value: 1600000,
    probability: 20,
  },
  {
    name: "Lucia Moreau",
    company: "Maison Verte",
    stage: "new",
    temperature: "cold",
    source: "social",
    estimated_value: 550000,
    probability: 10,
  },
]);

const projects = await insert("projects", [
    {
      name: "Terrace shop rebuild",
      code: "TER-04",
      client_id: client("Amine"),
      status: "active",
      priority: "high",
      budget: 2300000,
      spent: 1500000,
      progress: 62,
      accent: "clay",
      start_date: day(-40),
      due_date: day(24),
      description:
        "Headless storefront, subscription coffee, and a wholesale portal for the three new locations.",
      tags: ["ecommerce", "shopify"],
    },
    {
      name: "Nordwind ops dashboard",
      code: "NRD-11",
      client_id: client("Jonas"),
      status: "active",
      priority: "urgent",
      budget: 5500000,
      spent: 3600000,
      progress: 48,
      accent: "indigo",
      start_date: day(-70),
      due_date: day(35),
      description: "Fleet telemetry, driver scheduling, and a live cost-per-route view.",
      tags: ["saas", "charts"],
    },
    {
      name: "Vela brand refresh",
      code: "VEL-02",
      client_id: client("Clara"),
      status: "review",
      priority: "medium",
      budget: 980000,
      spent: 900000,
      progress: 88,
      accent: "plum",
      start_date: day(-55),
      due_date: day(6),
      description: "New identity, type system, and a one-page site.",
    },
    {
      name: "Studio site v3",
      status: "planning",
      priority: "low",
      budget: 0,
      spent: 0,
      progress: 8,
      accent: "sage",
      due_date: day(90),
      description: "Our own site. Case studies first, then the writing section.",
      tags: ["internal"],
    },
], "id,name");

const project = (name) => projects?.find((p) => p.name.startsWith(name))?.id ?? null;

/* boards -------------------------------------------------------------- */

const [board] = await insert(
  "boards",
  { name: "This quarter", emoji: "🎯", created_by: owner, position: 0 },
  "id",
);

const columns = await insert("board_columns", [
    { board_id: board.id, name: "Backlog", accent: "indigo", position: 0 },
    { board_id: board.id, name: "This week", accent: "amber", position: 1 },
    { board_id: board.id, name: "Doing", accent: "clay", position: 2 },
    { board_id: board.id, name: "Done", accent: "sage", position: 3 },
], "id,name");

const col = (name) => columns?.find((c) => c.name === name)?.id ?? null;

await insert("tasks", [
  {
    title: "Wholesale pricing tiers for Terrace",
    board_id: board.id,
    column_id: col("Doing"),
    project_id: project("Terrace"),
    priority: "high",
    assignee_id: owner,
    due_date: day(3),
    position: 0,
    labels: ["build"],
  },
  {
    title: "Route cost chart — pick the aggregation window",
    board_id: board.id,
    column_id: col("Doing"),
    project_id: project("Nordwind"),
    priority: "urgent",
    assignee_id: coOwner ?? owner,
    due_date: day(1),
    position: 1,
    labels: ["design", "data"],
  },
  {
    title: "Send Vela the final type specimen",
    board_id: board.id,
    column_id: col("This week"),
    project_id: project("Vela"),
    priority: "medium",
    assignee_id: coOwner ?? owner,
    due_date: day(2),
    position: 0,
  },
  {
    title: "Chase Elena on the Bright Path proposal",
    board_id: board.id,
    column_id: col("This week"),
    priority: "high",
    assignee_id: owner,
    due_date: day(0),
    position: 1,
  },
  {
    title: "Write the Nordwind case study",
    board_id: board.id,
    column_id: col("Backlog"),
    project_id: project("Studio"),
    priority: "low",
    position: 0,
  },
  {
    title: "Quarterly affiliate payouts",
    board_id: board.id,
    column_id: col("Backlog"),
    priority: "medium",
    due_date: day(12),
    position: 1,
  },
  {
    title: "Terrace subscription flow — first pass",
    board_id: board.id,
    column_id: col("Done"),
    project_id: project("Terrace"),
    status: "done",
    completed_at: at(-4, 17),
    position: 0,
  },
  {
    title: "Kick-off call with Nordwind",
    board_id: board.id,
    column_id: col("Done"),
    status: "done",
    completed_at: at(-9, 14),
    position: 1,
  },
]);

/* goals, events, notes, invoices --------------------------------------- */

await insert("goals", [
  {
    title: "Close 10M DA in new business",
    metric: "dinars",
    target_value: 10000000,
    current_value: 6000000,
    period: "quarter",
    status: "on_track",
    accent: "clay",
    owner_id: owner,
  },
  {
    title: "Ship three case studies",
    metric: "case studies",
    target_value: 3,
    current_value: 1,
    period: "quarter",
    status: "at_risk",
    accent: "amber",
  },
  {
    title: "Grow monthly retainers",
    metric: "dinars / month",
    target_value: 1500000,
    current_value: 980000,
    period: "year",
    status: "on_track",
    accent: "sage",
  },
]);

await insert("events", [
  {
    title: "Terrace weekly check-in",
    kind: "call",
    starts_at: at(1, 10),
    ends_at: at(1, 11),
    accent: "indigo",
    client_id: client("Amine"),
    project_id: project("Terrace"),
    created_by: owner,
  },
  {
    title: "Vela final presentation",
    kind: "meeting",
    starts_at: at(4, 14),
    ends_at: at(4, 15),
    location: "Google Meet",
    accent: "clay",
    client_id: client("Clara"),
    created_by: owner,
  },
  {
    title: "Nordwind milestone 2 due",
    kind: "deadline",
    starts_at: at(9, 9),
    all_day: true,
    accent: "rose",
    project_id: project("Nordwind"),
    created_by: owner,
  },
  {
    title: "Deep work — dashboard charts",
    kind: "focus",
    starts_at: at(2, 9),
    ends_at: at(2, 13),
    accent: "plum",
    created_by: coOwner ?? owner,
  },
  {
    title: "Atlas Outdoor negotiation call",
    kind: "call",
    starts_at: at(3, 16),
    accent: "indigo",
    created_by: owner,
  },
]);

await insert("notes", [
  {
    title: "Terrace — wholesale requirements",
    content:
      "Three tiers: cafe, restaurant, retail.\nNet 30 for restaurants only.\nThey want a CSV export for their accountant every month.\nSubscription boxes ship on the 3rd and the 17th.",
    tags: ["brief", "terrace"],
    client_id: client("Amine"),
    project_id: project("Terrace"),
    pinned: true,
    created_by: owner,
  },
  {
    title: "Pricing rules we keep forgetting",
    content:
      "Discovery is always billed, never free.\nRush work is +40%.\nAffiliate deals carry their commission in the quote, not out of margin.\nRetainers renew annually, invoiced monthly.",
    tags: ["pricing", "internal"],
    pinned: true,
    created_by: owner,
  },
  {
    title: "Nordwind kick-off notes",
    content:
      "Their fleet is 240 trucks across four depots.\nData lands in Postgres nightly, not live.\nThe cost-per-route view is the whole reason they hired us — lead with it.",
    tags: ["meeting"],
    client_id: client("Jonas"),
    project_id: project("Nordwind"),
    created_by: coOwner ?? owner,
  },
]);

const invoices = await insert("invoices", [
    {
      number: "INV-2025-018",
      client_id: client("Jonas"),
      project_id: project("Nordwind"),
      amount: 1800000,
      status: "paid",
      issued_on: monthsAgo(3),
      paid_on: monthsAgo(3),
    },
    {
      number: "INV-2025-021",
      client_id: client("Amine"),
      project_id: project("Terrace"),
      amount: 980000,
      status: "paid",
      issued_on: monthsAgo(2),
      paid_on: monthsAgo(2),
    },
    {
      number: "INV-2025-024",
      client_id: client("Jonas"),
      project_id: project("Nordwind"),
      amount: 1800000,
      status: "paid",
      issued_on: monthsAgo(1),
      paid_on: monthsAgo(1),
    },
    {
      number: "INV-2025-027",
      client_id: client("Clara"),
      project_id: project("Vela"),
      amount: 490000,
      status: "sent",
      issued_on: day(-12),
      due_on: day(18),
    },
    {
      number: "INV-2025-028",
      client_id: client("Amine"),
      project_id: project("Terrace"),
      amount: 810000,
      status: "overdue",
      issued_on: day(-46),
      due_on: day(-16),
    },
    {
      number: "INV-2025-029",
      client_id: client("Jonas"),
      amount: 580000,
      status: "draft",
      issued_on: day(-1),
      due_on: day(29),
    },
], "id,number");

await insert("commissions", [
  {
    affiliate_id: aff("Nadia"),
    client_id: client("Amine"),
    invoice_id: invoices?.[1]?.id ?? null,
    amount: 150000,
    rate: 15,
    status: "paid",
    earned_on: monthsAgo(2),
    paid_on: monthsAgo(2),
    note: "Terrace phase one",
  },
  {
    affiliate_id: aff("Tom"),
    client_id: client("Jonas"),
    invoice_id: invoices?.[2]?.id ?? null,
    amount: 180000,
    rate: 10,
    status: "pending",
    earned_on: monthsAgo(1),
    note: "Nordwind milestone 1",
  },
  {
    affiliate_id: aff("Nadia"),
    client_id: client("Amine"),
    amount: 120000,
    rate: 15,
    status: "approved",
    earned_on: day(-9),
    note: "Terrace wholesale add-on",
  },
]);

await insert("interactions", [
  {
    kind: "call",
    summary: "Walked through the wholesale tiers. They want net 30 for restaurants.",
    client_id: client("Amine"),
    occurred_at: at(-2, 15),
    created_by: owner,
  },
  {
    kind: "email",
    summary: "Sent revised timeline after the depot data arrived late.",
    client_id: client("Jonas"),
    occurred_at: at(-6, 9),
    created_by: coOwner ?? owner,
  },
  {
    kind: "meeting",
    summary: "Brand direction review. They picked the warmer palette.",
    client_id: client("Clara"),
    occurred_at: at(-11, 14),
    created_by: owner,
  },
]);

/* chat ----------------------------------------------------------------- */

const [conversation] = await insert(
  "conversations",
  { title: "Workspace", is_direct: true, created_by: owner },
  "id",
);

const members = [owner, coOwner].filter(Boolean);
await insert(
  "conversation_members",
  members.map((id) => ({ conversation_id: conversation.id, profile_id: id })),
);

if (coOwner) {
  await insert("messages", [
    {
      conversation_id: conversation.id,
      sender_id: owner,
      body: "Atlas Outdoor moved to negotiation. Their board meets on the 18th.",
      created_at: at(-1, 9),
    },
    {
      conversation_id: conversation.id,
      sender_id: coOwner,
      body: "Nice. I'll hold the last week of the month in case it lands.",
      created_at: at(-1, 10),
    },
    {
      conversation_id: conversation.id,
      sender_id: coOwner,
      body: "Also the Vela specimen is ready, sending it over tomorrow morning.",
      created_at: at(-1, 11),
    },
  ]);
}

console.log("\n  Sample data added. Sign in and take a look.\n");
