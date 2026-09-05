-- ===========================================================================
--  Atelier CRM — initial schema
--  Private two-person workspace: every authenticated user is a member of the
--  workspace and may read/write all records. Access is controlled by who gets
--  an account (invite-only, created with the service role key).
-- ===========================================================================

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------- helpers --

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -------------------------------------------------------------- profiles --

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null default 'Member',
  email        text,
  avatar_url   text,
  role         text not null default 'owner' check (role in ('owner', 'partner')),
  accent       text not null default 'clay',
  title        text,
  timezone     text default 'UTC',
  last_seen_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Every policy below reduces to "is this a signed-in member?".
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid());
$$;

-- New auth users get a profile automatically.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------ affiliates --
-- People who send leads my way and earn commission on what closes.

create table if not exists public.affiliates (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  company         text,
  email           text,
  phone           text,
  status          text not null default 'active'
                    check (status in ('active', 'paused', 'ended')),
  commission_rate numeric(5,2) not null default 10 check (commission_rate >= 0 and commission_rate <= 100),
  payout_method   text,
  payout_details  text,
  notes           text,
  accent          text not null default 'indigo',
  joined_at       date not null default current_date,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------- leads --
-- Potential clients moving through the pipeline.

create table if not exists public.leads (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  company        text,
  email          text,
  phone          text,
  website        text,
  stage          text not null default 'new'
                   check (stage in ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  temperature    text not null default 'warm'
                   check (temperature in ('cold', 'warm', 'hot')),
  source         text not null default 'direct'
                   check (source in ('direct', 'affiliate', 'referral', 'inbound', 'outbound', 'social', 'other')),
  affiliate_id   uuid references public.affiliates(id) on delete set null,
  estimated_value numeric(12,2) default 0,
  probability    int default 30 check (probability between 0 and 100),
  expected_close date,
  owner_id       uuid references public.profiles(id) on delete set null,
  tags           text[] not null default '{}',
  notes          text,
  lost_reason    text,
  position       int not null default 0,
  last_contact_at timestamptz,
  converted_client_id uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- --------------------------------------------------------------- clients --
-- Won business. A lead becomes a client on conversion.

create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  company       text,
  email         text,
  phone         text,
  website       text,
  address       text,
  country       text,
  status        text not null default 'active'
                  check (status in ('active', 'paused', 'churned')),
  health        text not null default 'good'
                  check (health in ('good', 'watch', 'at_risk')),
  tier          text not null default 'standard'
                  check (tier in ('standard', 'key', 'strategic')),
  source        text not null default 'direct',
  affiliate_id  uuid references public.affiliates(id) on delete set null,
  lead_id       uuid references public.leads(id) on delete set null,
  owner_id      uuid references public.profiles(id) on delete set null,
  lifetime_value numeric(12,2) not null default 0,
  retainer_amount numeric(12,2),
  accent        text not null default 'clay',
  tags          text[] not null default '{}',
  notes         text,
  since         date not null default current_date,
  last_contact_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.leads
  drop constraint if exists leads_converted_client_id_fkey;
alter table public.leads
  add constraint leads_converted_client_id_fkey
  foreign key (converted_client_id) references public.clients(id) on delete set null;

-- ------------------------------------------------------------- projects --

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text,
  description text,
  client_id   uuid references public.clients(id) on delete set null,
  status      text not null default 'planning'
                check (status in ('planning', 'active', 'on_hold', 'review', 'done', 'cancelled')),
  priority    text not null default 'medium'
                check (priority in ('low', 'medium', 'high', 'urgent')),
  budget      numeric(12,2) default 0,
  spent       numeric(12,2) default 0,
  currency    text not null default 'DZD',
  progress    int not null default 0 check (progress between 0 and 100),
  accent      text not null default 'indigo',
  start_date  date,
  due_date    date,
  owner_id    uuid references public.profiles(id) on delete set null,
  tags        text[] not null default '{}',
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------- planning workspace --

create table if not exists public.boards (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  emoji       text default '🗂️',
  description text,
  project_id  uuid references public.projects(id) on delete cascade,
  position    int not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.board_columns (
  id        uuid primary key default gen_random_uuid(),
  board_id  uuid not null references public.boards(id) on delete cascade,
  name      text not null,
  accent    text not null default 'indigo',
  position  int not null default 0,
  wip_limit int,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  notes       text,
  board_id    uuid references public.boards(id) on delete cascade,
  column_id   uuid references public.board_columns(id) on delete cascade,
  project_id  uuid references public.projects(id) on delete cascade,
  client_id   uuid references public.clients(id) on delete set null,
  assignee_id uuid references public.profiles(id) on delete set null,
  priority    text not null default 'medium'
                check (priority in ('low', 'medium', 'high', 'urgent')),
  status      text not null default 'todo'
                check (status in ('todo', 'doing', 'blocked', 'done')),
  due_date    date,
  estimate_minutes int,
  labels      text[] not null default '{}',
  position    int not null default 0,
  completed_at timestamptz,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.subtasks (
  id       uuid primary key default gen_random_uuid(),
  task_id  uuid not null references public.tasks(id) on delete cascade,
  title    text not null,
  done     boolean not null default false,
  position int not null default 0
);

create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  title      text not null default 'Untitled',
  content    text not null default '',
  cover      text,
  pinned     boolean not null default false,
  tags       text[] not null default '{}',
  client_id  uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goals (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  metric        text not null default 'count',
  target_value  numeric(12,2) not null default 100,
  current_value numeric(12,2) not null default 0,
  period        text not null default 'quarter'
                  check (period in ('week', 'month', 'quarter', 'year')),
  starts_on     date not null default date_trunc('quarter', current_date)::date,
  ends_on       date,
  accent        text not null default 'sage',
  status        text not null default 'on_track'
                  check (status in ('on_track', 'at_risk', 'behind', 'done')),
  owner_id      uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- -------------------------------------------------------------- calendar --

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  kind        text not null default 'meeting'
                check (kind in ('meeting', 'call', 'deadline', 'reminder', 'focus', 'personal')),
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  all_day     boolean not null default false,
  location    text,
  accent      text not null default 'clay',
  client_id   uuid references public.clients(id) on delete cascade,
  lead_id     uuid references public.leads(id) on delete cascade,
  project_id  uuid references public.projects(id) on delete cascade,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------ interactions --
-- Every touchpoint with a client or lead, for the relationship timeline.

create table if not exists public.interactions (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'note'
                check (kind in ('note', 'call', 'email', 'meeting', 'proposal', 'payment')),
  summary     text not null,
  detail      text,
  client_id   uuid references public.clients(id) on delete cascade,
  lead_id     uuid references public.leads(id) on delete cascade,
  affiliate_id uuid references public.affiliates(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- --------------------------------------------------------------- money --

create table if not exists public.invoices (
  id         uuid primary key default gen_random_uuid(),
  number     text not null,
  client_id  uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  amount     numeric(12,2) not null default 0,
  currency   text not null default 'DZD',
  status     text not null default 'draft'
               check (status in ('draft', 'sent', 'paid', 'overdue', 'void')),
  issued_on  date not null default current_date,
  due_on     date,
  paid_on    date,
  notes      text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commissions (
  id           uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  lead_id      uuid references public.leads(id) on delete set null,
  client_id    uuid references public.clients(id) on delete set null,
  invoice_id   uuid references public.invoices(id) on delete set null,
  amount       numeric(12,2) not null default 0,
  rate         numeric(5,2),
  status       text not null default 'pending'
                 check (status in ('pending', 'approved', 'paid', 'cancelled')),
  earned_on    date not null default current_date,
  paid_on      date,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------- chat --

create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  title      text,
  is_direct  boolean not null default true,
  topic      text,
  created_by uuid references public.profiles(id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null default '',
  attachment_url  text,
  attachment_name text,
  reply_to        uuid references public.messages(id) on delete set null,
  edited_at       timestamptz,
  created_at      timestamptz not null default now()
);

create or replace function public.bump_conversation()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists on_message_insert on public.messages;
create trigger on_message_insert
  after insert on public.messages
  for each row execute function public.bump_conversation();

-- ------------------------------------------------------------ activity --

create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  entity_label text,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------- indexes --

create index if not exists idx_leads_stage        on public.leads(stage);
create index if not exists idx_leads_affiliate    on public.leads(affiliate_id);
create index if not exists idx_clients_status     on public.clients(status);
create index if not exists idx_projects_client    on public.projects(client_id);
create index if not exists idx_projects_status    on public.projects(status);
create index if not exists idx_tasks_board        on public.tasks(board_id);
create index if not exists idx_tasks_column       on public.tasks(column_id, position);
create index if not exists idx_tasks_project      on public.tasks(project_id);
create index if not exists idx_tasks_assignee     on public.tasks(assignee_id);
create index if not exists idx_events_starts      on public.events(starts_at);
create index if not exists idx_messages_conv      on public.messages(conversation_id, created_at desc);
create index if not exists idx_interactions_client on public.interactions(client_id, occurred_at desc);
create index if not exists idx_interactions_lead  on public.interactions(lead_id, occurred_at desc);
create index if not exists idx_activities_created on public.activities(created_at desc);
create index if not exists idx_commissions_aff    on public.commissions(affiliate_id, status);

-- --------------------------------------------------- updated_at triggers --

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','affiliates','leads','clients','projects','boards','tasks',
    'notes','goals','events','invoices','commissions'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ------------------------------------------------------------------ RLS --

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','affiliates','leads','clients','projects','boards','board_columns',
    'tasks','subtasks','notes','goals','events','interactions','invoices',
    'commissions','conversations','conversation_members','messages','activities'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists members_all on public.%I', t);
    execute format(
      'create policy members_all on public.%I
         for all to authenticated
         using (public.is_member()) with check (public.is_member())', t);
  end loop;
end $$;

-- --------------------------------------------------------------- realtime --

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Adding a table twice is an error, so only add what is missing.
do $$
declare t text;
begin
  foreach t in array array['messages', 'tasks', 'activities', 'profiles'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

alter table public.messages replica identity full;
alter table public.tasks replica identity full;

-- --------------------------------------------------------------- storage --

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

drop policy if exists "avatars read"  on storage.objects;
drop policy if exists "avatars write" on storage.objects;
drop policy if exists "attachments rw" on storage.objects;

create policy "avatars read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars write" on storage.objects
  for all to authenticated
  using (bucket_id = 'avatars') with check (bucket_id = 'avatars');

create policy "attachments rw" on storage.objects
  for all to authenticated
  using (bucket_id = 'attachments' and public.is_member())
  with check (bucket_id = 'attachments' and public.is_member());
