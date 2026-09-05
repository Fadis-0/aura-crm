# Aura CRM

A private CRM and studio workspace. Two owners run everything; marketers sign
themselves up and get a restricted portal for the campaigns they promote.
Clients, pipeline, affiliate partners, projects, planning boards, calendar,
invoices and realtime chat, all stored in your own Supabase project.

Next.js 16 · React 19 · TypeScript · Tailwind 4 · Supabase.

---

## Setup

### 1. Create the Supabase project

Go to [supabase.com](https://supabase.com), create a project, and keep the
database password you set. Then open **Project Settings → API** and copy:

- Project URL
- `anon` public key
- `service_role` key

From **Project Settings → Database → Connection string → URI**, copy the
Postgres connection string.

If `npm run db:push` cannot resolve `db.<ref>.supabase.co`, that host is
IPv6-only and your network has no IPv6 route. Use the session-mode pooler
instead, which looks like
`postgresql://postgres.<ref>:PASSWORD@aws-0-<region>.pooler.supabase.com:5432/postgres`.

### 2. Fill in the environment

```bash
cp .env.example .env.local
```

Paste the four Supabase values in, then set the two accounts at the bottom of
the file. `OWNER_*` is you, `CO_OWNER_*` is her. Both are owners with equal
standing. Use long passwords.

`.env.local` is git-ignored. Nothing in it ever reaches the browser except the
two `NEXT_PUBLIC_` values.

### 3. Build the database

```bash
npm run db:push
```

Creates every table, the row-level security policies, the realtime publication,
and the two storage buckets.

### 4. Create the accounts

```bash
npm run db:seed
```

Creates both accounts, email confirmed and ready to sign in, and leaves the
workspace empty. Add `-- --demo` if you would rather start with sample records
to look at:

```bash
npm run db:seed -- --demo
```

Re-running is safe. Existing accounts are reused, and demo rows are only added
to an empty database. To wipe every record later and keep both accounts, run
`npm run db:reset`.

### 5. Run it

```bash
npm run dev
```

Open http://localhost:3000 and sign in with the owner email and password.

---

## What is in it

| Area | What it does |
| --- | --- |
| **Dashboard** | Weighted pipeline, cash collected, six-month revenue chart, today's schedule, tasks due, affiliate leaderboard, projects in flight |
| **Pipeline** | Drag leads across seven stages. Converting a won lead creates the client and books the affiliate's commission automatically |
| **Clients** | Card and table views, health and tier, lifetime value, retainers, linked projects and invoices, and a per-client interaction timeline |
| **Affiliates** | Referral counts, conversion rate, commission earned and owed, one-click payout marking |
| **Projects** | Budget against spend, progress, task checklist, linked invoices, per-project colour |
| **Planning** | Kanban boards with custom columns, a "my week" view bucketed by due date, and countable quarterly goals |
| **Notes** | Masonry note wall with pinning, tags, and links to a client or project |
| **Calendar** | Month grid and agenda, six event kinds, double-click a day to add |
| **Messages** | Realtime one-to-one chat with presence, typing indicators, and optimistic sending |
| **Invoices** | Draft, sent, paid and overdue tracking with totals |
| **Notifications** | A bell in the top bar for marketer signups, project pickups, new leads and stage changes, live over websockets |

### The marketer portal

Marketers sign up at `/signup` with their name, email, phone, optional social
link, wilaya, commune, address and a password. They land on a waiting screen
and you get a notification. Approve them from the **Affiliates** page.

You can also add a partner yourself with **Affiliates → New**. That form takes
the same details plus an email and password, and the account is live at once:
you vouching for someone is the approval. Pass the credentials on and they can
change the password from their settings.

What a marketer can do:

- See the projects you marked **open for affiliates**, and nothing else.
- Read the brief, the commission rate and the payout terms you wrote.
- Download the files you uploaded and follow the links you added.
- Add a project to their list, or drop it.
- Add leads and drag them along their own pipeline.
- See their own commissions, paid and owed.
- Set the CCP account their payouts go to.

**Commission** is a flat amount per closed deal by default, set per partner and
optionally overridden per project. Switch a partner or a project to a
percentage of the deal value when that is the arrangement. Payouts go to a CCP
account: the RIP is the only payout route the app records.

What a marketer cannot do, enforced by the database rather than the interface:
see clients, invoices, notes, chat, planning, other marketers' leads, or any
project you have not opened up. A suspended or unapproved account sees nothing
at all.

To open a project up, go to the project and switch on **Affiliate programme**.
Write the brief, set the rate, upload files or paste links, then save.

Money is Algerian dinar throughout, written as `35,500 DA`. To change it, edit
`CURRENCY_SUFFIX` in `src/lib/utils.ts` and every amount in the app follows.

**Creating records.** The top bar's **Create something** button opens a picker
for any record type. Each page also has its own **New** button, locked to that
page's type. Either way the record shows up immediately, no reload.

Anywhere a field points at another record — the affiliate who brought a lead in,
a client, a project — the picker is searchable. On a lead, choosing Affiliate as
the source reveals the picker for who referred them.

Press `Ctrl K` for the command palette, `Ctrl J` to create anything.

---

## Adding another account later

```bash
npm run db:user -- someone@example.com "their-password" "Their Name" owner
```

The last argument is the role: `owner` and `partner` both get the full back
office, `marketer` gets the portal. Owners are only ever created this way. The
public signup form always creates a pending marketer, never an owner.

---

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new).
3. Add the environment variables under **Settings → Environment Variables**:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY`. The `OWNER_*`, `CO_OWNER_*` and `SUPABASE_DB_URL`
   values are only needed locally for the scripts.
4. Deploy.

In Supabase, add your production URL under **Authentication → URL Configuration
→ Site URL**.

---

## Security model

Every table has row-level security on, and the rules are role-aware.

Owners read and write everything. Approved marketers get exactly four things:
projects flagged `open_for_affiliates`, those projects' assets, the leads whose
`affiliate_id` is their own, and their own commissions. Everything else returns
zero rows, whether the request comes from the app or from someone poking the
API with their own token. Pending and suspended accounts get nothing but their
own profile row.

Project files live in a private storage bucket. Marketers never receive a public
URL; the app mints a five-minute signed link at the moment they click download,
and the storage policy checks that the file's folder belongs to a project that
is actually open to them.

The `service_role` key bypasses row-level security and is used only by the
scripts in `scripts/`, which run on your machine. It is never imported into a
client component.

---

## Project layout

```
src/
  app/
    (app)/            the owners' back office
    (portal)/         the marketers' restricted portal
    login/            sign in
    signup/           marketer self-signup
  components/
    shell/            sidebar, top bar, command palette, notifications
    portal/           the marketer shell, approval gate, lead form
    assets/           the project asset library, admin and read-only
    admin/            marketer approval
    create-dialog.tsx one create form for every record type
    combobox.tsx      the searchable picker
    ui.tsx            buttons, cards, fields, badges, avatars
    overlays.tsx      modal, drawer, menu, confirm
    theme.tsx         light / dark / system
  lib/
    supabase/         browser, server and service-role clients
    types.ts          every row type and its display labels
    auth.ts           who is signed in and what they may do
    use-server-state.ts  keeps a page in step with fresh server data
supabase/migrations/  the schema
scripts/              migrate, seed, create-user
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run db:push` | Apply the SQL migrations |
| `npm run db:seed` | Create the two accounts |
| `npm run db:seed -- --demo` | Also add sample records |
| `npm run db:reset` | Delete every record, keep the accounts |
| `npm run db:user` | Create one more account |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
