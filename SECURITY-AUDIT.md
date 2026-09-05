# Aura CRM — security review

Reviewed: the whole app as it stands on `main` (commit `3b2db82`) — the Next.js
proxy and auth helpers, every server action, all seven Supabase migrations (RLS
policies, `security definer` functions, triggers, storage buckets), and the
client components that talk to Supabase directly.

**Headline: two critical privilege-escalation paths. Either one turns a stranger
into a full owner of your workspace.** Fix those first; the rest can wait a week.

Two caveats on scope. I could not read your Supabase dashboard settings, so a few
items say "verify in dashboard" — those need your eyes. And I did not run any of
these exploits against your live project; they are read from the migration
source, which is the authority on what the database actually enforces.

---

## STATUS — all findings fixed (verified against the live database)

Applied as `supabase/migrations/0008_security.sql` plus the code changes below.
`npm run db:push` is idempotent and was run twice to prove it.

| # | Fix | Where |
|---|---|---|
| C1 | Signup trigger never reads a role from metadata; everyone starts a pending marketer | `0008` |
| C2 | `guard_profile_privileges` trigger blocks self-changes to role/status/approval | `0008` |
| H1 | `tasks`, `activities`, `profiles`, `project_plans` unpublished; `replica identity default` | `0008` |
| M1 | `avatars` writes scoped to the caller's own folder | `0008` |
| M2 | `attachments` narrowed to `is_admin()` | `0008` |
| M3 | `projects_public` view; marketers' base-table policy dropped | `0008` + 8 portal files |
| M4 | Security headers incl. `frame-ancestors 'none'` | `next.config.ts` |
| M5 | `next` validated as a same-site path | `login-form.tsx` |
| M6 | Admin-created partners must replace the password on first sign-in | `0008`, `password-gate.tsx`, portal layout, `actions.ts` |
| M7 | Notifications split into read + mark-as-read | `0008` |
| L1 | Proxy inverted to an allowlist | `proxy.ts` |
| L2 | Proxy now requires `status = 'active'` for admin | `proxy.ts` |
| L3 | `isMarketer` requires `status = 'active'` | `lib/auth.ts` |
| L5 | Corrected the stale comment | `.env.example` |
| Bug | Payout details save via `set_my_payout()` RPC | `0008`, `portal-settings.tsx` |

**No compromise.** `profiles` holds exactly two privileged accounts —
`fadi@aura.app` and `melissa@aura.app`, both created at seed time on
2026-09-04. Nobody used the C1 door.

### Two things still need you, in the Supabase dashboard

1. **Enable "Secure password change"** (Authentication → Providers → Email), so
   changing a password requires a recent login. This is L4; it cannot be set
   from a migration.
2. **Enable email confirmation for signups**, so an unverified address cannot
   hold an account. C1 is closed either way — a signup can now only ever produce
   a pending marketer — but confirmation stops the pending queue filling with
   addresses nobody controls. You currently have **7 pending marketers**; worth
   a look to see whether you recognise them.

### Two deviations from what this report originally recommended

- **C2 does not use column grants.** I proposed `revoke update ... grant update
  (safe columns)`. That would have broken admin approvals: admins are the same
  `authenticated` Postgres role as marketers, and column privileges cannot tell
  them apart, so revoking `status` would have blocked the approve button too.
  The trigger can tell them apart, so it does the whole job.
- **M3's view is not `security_invoker`.** As originally written the view would
  still have required a select policy on `projects`, and a marketer holding that
  policy could simply query the base table and get every column anyway. The view
  runs as its owner instead, does its own filtering, and the marketers' policy on
  the base table is dropped. `description` is included in the view — it is the
  project blurb the portal already falls back to; `budget`, `spent`, `owner_id`,
  `tags`, `client_id`, `priority`, `progress` and `start_date` are the ones now
  withheld.

---

## CRITICAL

### C1 — Anyone can sign up as an owner

`supabase/migrations/0004_profile_and_docs.sql:200`

```sql
wanted_role text := coalesce(new.raw_user_meta_data ->> 'role', 'owner');
...
if wanted_role not in ('owner', 'partner', 'marketer') then
  wanted_role := 'marketer';
end if;
new_status := case when wanted_role = 'marketer' then 'pending' else 'active' end;
```

`raw_user_meta_data` is **whatever the client passed to `auth.signUp`**. It is
not trusted input. Signup is public and the anon key ships in the browser, so
anyone can run:

```js
supabase.auth.signUp({
  email, password,
  options: { data: { role: "owner" } },
})
```

The guard only rejects values outside the three-item list — `'owner'` is *in* the
list, so it passes straight through, and `new_status` becomes `'active'` because
the pending rule only applies to marketers. Result: an immediately active owner.
Every client, lead, invoice, commission and project is theirs to read, edit or
delete.

It is worse than the metadata path suggests, because the fallback is `'owner'`. A
signup carrying no role at all — a bare POST to the Supabase auth endpoint — also
lands as an owner. Your `/signup` form always sends `role: "marketer"`, which is
exactly why this has never shown up in normal use.

This is a leftover from when the app had no signup page. `.env.example` still says
so: *"There is no sign-up page, so these are the only two people who can ever get
in."* That assumption stopped being true when `/signup` shipped.

**Fix.** Default to least privilege, and never let metadata name a privileged
role. Public signup should only ever produce a pending marketer:

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  wanted_role text := coalesce(new.raw_user_meta_data ->> 'role', 'marketer');
  ...
begin
  -- Only a service-role caller may name a privileged role. Anything arriving
  -- from a public signup is a pending marketer, whatever it claims to be.
  if wanted_role <> 'marketer'
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
  then
    wanted_role := 'marketer';
  end if;
  ...
```

Then verify nobody got in already:

```sql
select id, email, role, status, created_at
  from public.profiles
 where role in ('owner', 'partner');
```

If there is a row there that is not you or Melissa, you have already been hit.
Cross-check `auth.users.created_at` for anything you do not recognise.

While you are in the dashboard: turn on email confirmation for signups, so an
unverified address cannot hold an account at all.

### C2 — A marketer can promote themselves to owner

`supabase/migrations/0003_marketers.sql:432`

```sql
create policy profiles_self_write on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
```

The intent is "you may edit your own profile". But **an RLS policy cannot
restrict which columns get written** — it only decides which *rows* are
reachable. `role` and `status` live on that row. So any signed-in marketer can
run this from their browser console, using the anon key already loaded on the
page:

```js
await supabase.from("profiles")
  .update({ role: "owner", status: "active" })
  .eq("id", MY_USER_ID)
```

Both checks pass — it is their own row. They are now an owner. This also
neutralises the approval workflow: a `pending` marketer waiting on you can
approve themselves.

I checked for the two things that would have stopped this. There is no column
`grant`/`revoke` anywhere in the migrations, and the only `before update` trigger
on `profiles` (`notify_account_status`) just sends notifications.

**Fix.** Two layers, both cheap:

```sql
-- 1. Column privileges: the API roles simply cannot write these columns.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, avatar_url, phone, social_url, wilaya, commune,
              address_line, postal_code, timezone, title, accent)
  on public.profiles to authenticated;

-- 2. A trigger, so the rule holds even if a future grant is sloppy.
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if new.role <> old.role
     or new.status <> old.status
     or new.approved_at is distinct from old.approved_at
     or new.approved_by is distinct from old.approved_by then
    raise exception 'Only an admin can change role or status'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_guard on public.profiles;
create trigger on_profile_guard before update on public.profiles
  for each row execute function public.guard_profile_privileges();
```

`is_admin()` is itself `security definer` and reads `profiles`, so it keeps
working inside the trigger.

---

## HIGH

### H1 — Realtime DELETE events leak admin-only rows to marketers

`0001_init.sql:482` publishes `messages`, `tasks`, `activities` and `profiles` to
`supabase_realtime`, and `messages` and `tasks` are set to `replica identity
full`.

Supabase Realtime applies RLS to INSERT and UPDATE, **but not to DELETE**. With
`replica identity full`, a delete payload carries the entire old row. Any
authenticated user — including a marketer with no rights to `messages` or `tasks`
at all — can open a channel on those tables and receive full row contents as they
are deleted. Your private chat with Melissa is in `messages`.

**Fix.** Publish only what is consumed. Your client subscribes to exactly two
things: `notifications`, and `messages` in `chat-room.tsx`. So the rest can come
out of the publication:

```sql
alter publication supabase_realtime drop table public.tasks;
alter publication supabase_realtime drop table public.activities;
alter publication supabase_realtime drop table public.profiles;
```

For `messages`, drop back to `replica identity default` so a delete carries only
the primary key:

```sql
alter table public.messages replica identity default;
```

Chat still works — it subscribes to INSERT, which is unaffected.

---

## MEDIUM

### M1 — `avatars` bucket is public and world-writable by any account

`0001_init.sql:509`

```sql
create policy "avatars write" on storage.objects
  for all to authenticated
  using (bucket_id = 'avatars') with check (bucket_id = 'avatars');
```

No path scoping. Any authenticated user — including a `pending` marketer who is
otherwise locked out of everything — can overwrite or delete **any** avatar and
upload arbitrary files. The bucket is `public = true`, so anything landing there
is world-readable by URL: a free anonymous file host attached to your domain.

Nothing in `src/` uploads to this bucket. If it is genuinely unused, drop it.
Otherwise scope writes to the owner's own folder:

```sql
create policy "avatars write" on storage.objects
  for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
```

### M2 — `attachments` bucket is fully shared with every marketer

`0001_init.sql:516` gates that bucket on `is_member()`, which is `is_admin() OR
is_marketer()`. Every approved marketer can read, overwrite and delete every file
in it, with no per-project or per-owner scoping. `messages` is an admin-only
table, so any chat attachment stored here is readable by people who cannot see
the message it belongs to.

Also unused by current `src/` code. Drop the bucket, or narrow the policy to
`is_admin()` and add a scoped read for marketers the way `project-assets` already
does — that one is correctly written and is a good model.

### M3 — Marketers receive your project budgets

`projects_marketer_read` lets a marketer select any project row where
`open_for_affiliates` is true. RLS is row-level, so that means **all columns** —
including `budget`, `spent`, `description`, internal `tags` and `owner_id`. The
portal fetches `select("*")` in three places, so those values sit in the browser
of every marketer whether or not the UI renders them.

**Fix.** Expose a view with only the marketer-facing columns:

```sql
create or replace view public.projects_public
with (security_invoker = true) as
  select id, name, code, accent, status, due_date, archived,
         open_for_affiliates, affiliate_brief, affiliate_payout_note
  from public.projects;
```

Then swap `from("projects")` for `from("projects_public")` in the portal files.
`security_invoker` keeps the caller's RLS applied, so the existing policy still
does the row filtering.

### M4 — No security headers

`next.config.ts` is empty. No CSP, no `frame-ancestors`, no HSTS, no
`Referrer-Policy`, no `X-Content-Type-Options`. Clickjacking matters most here: a
CRM with one-click destructive actions can be framed on an attacker's page and
clicked through invisibly.

```ts
const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      ],
    }];
  },
};
```

A CSP is worth adding too, but it needs care with Next's inline scripts — do it
as a separate pass with `Content-Security-Policy-Report-Only` first.

### M5 — Open redirect on the login page

`src/app/login/login-form.tsx:14`

```js
const next = params.get("next") || "/";
...
router.replace(next);
```

`next` is unvalidated, so `/login?next=https://evil.example` (or the
protocol-relative `//evil.example`) bounces a freshly-authenticated user off-site.
Good phishing material, because the link genuinely starts at your domain.

Your own proxy only ever sets `next` to a pathname, so the check is free:

```js
const raw = params.get("next") || "/";
const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
```

### M6 — Admins type their partners' passwords

`createPartnerAccount` takes a password the admin chose and creates the account
with `email_confirm: true`. The admin therefore knows a working credential for
that person indefinitely, and the password travels through the form and the
action's arguments. It also means the partner never proves they control the email
address.

Prefer `inviteUserByEmail`, or create with a random password and send a recovery
link, so the partner sets their own secret and you never hold it. If you keep the
current flow, at minimum force a change on first sign-in.

### M7 — Users can forge their own notifications

`notifications_own` is `for all`, so a marketer can INSERT rows addressed to
themselves and DELETE ones they dislike. Low impact — it is self-directed — but it
lets someone quietly erase an audit trail they are meant to see. Narrow it:

```sql
drop policy if exists notifications_own on public.notifications;

create policy notifications_own_read on public.notifications
  for select to authenticated using (recipient_id = auth.uid());

create policy notifications_own_seen on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
```

Marking-as-read needs UPDATE, so the same column caveat as C2 applies — but the
blast radius is one person's own notification row.

---

## LOW / hygiene

- **L1 — `proxy.ts` guards admin routes with a denylist.** `ADMIN_PATHS` lists ten
  paths explicitly. Complete today, but any admin route added later is
  unprotected at the proxy by default. Invert it: treat everything that is not
  public and not `/portal` as admin-only. The `(app)` layout's `getSession` check
  is the real enforcement, so this is defence in depth, not a live hole.
- **L2 — Role checks disagree.** `proxy.ts` computes `isAdmin` from role alone;
  `lib/auth.ts` also requires `status === 'active'`. A suspended owner clears the
  proxy and is then bounced by the layout. Harmless today, confusing later.
- **L3 — `getSession().isMarketer` ignores `status`.** The portal layout and
  `is_marketer()` both check it, so nothing leaks, but the flag reads as more
  trustworthy than it is.
- **L4 — Password change without re-authentication.** `portal-settings.tsx` calls
  `auth.updateUser({ password })` directly, so a hijacked session becomes a
  permanent takeover. Enable "Secure password change" in Supabase auth settings
  to require a recent login.
- **L5 — Stale `.env.example` comment** claims there is no signup page. It is what
  let C1 sit unnoticed.

---

## Bug found while reading (not a vulnerability)

`portal-settings.tsx:84` updates the `affiliates` table to save CCP payout
details, but `affiliates_self` is **SELECT-only** and `affiliates_admin_all`
requires `is_admin()`. A marketer saving their payout details gets an RLS error.
It fails closed, so nothing leaks — but the feature does not work. Either add a
scoped update policy plus column grants for `ccp_rip`/`ccp_holder`, or move the
save into an admin-gated server action.

---

## What is already right

Worth saying, because it is a lot — and it is why the two criticals are the only
deep problems:

- `getSession` uses `auth.getUser()`, which validates the JWT against the auth
  server rather than trusting the cookie. That is the most commonly botched thing
  in Supabase apps.
- The blanket `members_all` policy from `0001` is dropped on all 19 tables in
  `0003`. I checked each one; there are no leftovers.
- Every one of the 23 tables has RLS enabled.
- `is_admin()` and `is_marketer()` both require `status = 'active'`, so pending
  and suspended accounts get nothing from the database regardless of the UI.
- The `project-assets` bucket policy is genuinely well built — private bucket,
  folder-scoped, `can_see_project()` on the path, and `safe_uuid()` so a
  malformed path returns null instead of erroring.
- Marketer scoping on `leads`, `interactions`, `commissions` and
  `project_marketers` is correct, and `commissions` is read-only for marketers,
  so nobody can write their own payout.
- The service-role key is referenced in exactly one file, marked `server-only`.
  It cannot reach the browser.
- No `dangerouslySetInnerHTML` or `innerHTML` anywhere in `src/`.
- `.env*` is gitignored and only `.env.example` is tracked; no secret has been
  committed.
- `npm audit --omit=dev` reports zero vulnerabilities.

---

## Suggested order

1. **C2** — one migration, closes self-promotion. Fastest real win.
2. **C1** — one migration, closes the open door. Then audit `profiles` for owner
   rows you do not recognise.
3. **H1** — three `alter publication` lines plus one `replica identity`.
4. **M1, M2** — drop the two unused buckets.
5. **M4, M5** — a config block and a one-line guard.
6. **M3, M6, M7** — the view swap and the invite flow need code changes.
7. The L items whenever you are next in those files.
