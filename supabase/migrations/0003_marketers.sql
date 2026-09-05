-- ===========================================================================
--  Marketers
--
--  A second kind of account. Marketers sign themselves up, wait for an admin
--  to approve them, and then see a small slice of the workspace: the projects
--  opened for affiliation, those projects' files and links, the leads they
--  themselves submitted, and their own earnings. Nothing else.
--
--  Every table's blanket "any member" policy is replaced here with real
--  role-aware rules, so a marketer session cannot read clients, invoices,
--  notes, chat, or another marketer's leads even by calling the API directly.
-- ===========================================================================

-- ---------------------------------------------------------------- profiles --

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('owner', 'partner', 'marketer'));

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists social_url text;
alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles add column if not exists approved_at timestamptz;
alter table public.profiles add column if not exists approved_by uuid references public.profiles(id) on delete set null;

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles
  add constraint profiles_status_check
  check (status in ('pending', 'active', 'suspended'));

-- The two owners were created before this column existed.
update public.profiles set status = 'active' where role in ('owner', 'partner');

-- ------------------------------------------------------------- affiliates --
-- A marketer account owns exactly one affiliate record, so every commission,
-- referral and payout already in the app keeps working unchanged.

alter table public.affiliates add column if not exists profile_id uuid
  references public.profiles(id) on delete cascade;

create unique index if not exists affiliates_profile_id_key
  on public.affiliates(profile_id) where profile_id is not null;

-- --------------------------------------------------------------- projects --

alter table public.projects add column if not exists open_for_affiliates boolean not null default false;
alter table public.projects add column if not exists affiliate_brief text;
alter table public.projects add column if not exists affiliate_commission_rate numeric(5,2);
alter table public.projects add column if not exists affiliate_payout_note text;

create index if not exists idx_projects_open_for_affiliates
  on public.projects(open_for_affiliates) where open_for_affiliates;

-- ---------------------------------------------------------- project assets --
-- Files in the `project-assets` bucket, or plain links to a demo or a video.

create table if not exists public.project_assets (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  kind         text not null default 'file'
                 check (kind in ('file', 'link', 'video', 'doc', 'image')),
  title        text not null,
  description  text,
  url          text,
  storage_path text,
  mime_type    text,
  size_bytes   bigint,
  position     int not null default 0,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  -- Either it lives in storage or it points somewhere. Never neither.
  constraint project_assets_target check (url is not null or storage_path is not null)
);

create index if not exists idx_project_assets_project
  on public.project_assets(project_id, position);

-- ------------------------------------------------------- project marketers --
-- Which marketers have taken a project on.

create table if not exists public.project_marketers (
  project_id   uuid not null references public.projects(id) on delete cascade,
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  status       text not null default 'active'
                 check (status in ('active', 'paused', 'left')),
  note         text,
  joined_at    timestamptz not null default now(),
  primary key (project_id, affiliate_id)
);

create index if not exists idx_project_marketers_affiliate
  on public.project_marketers(affiliate_id);

-- ----------------------------------------------------------- notifications --

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  -- 'admins' reaches both owners; a profile id reaches one person.
  audience     text not null default 'admins' check (audience in ('admins', 'user')),
  recipient_id uuid references public.profiles(id) on delete cascade,
  actor_id     uuid references public.profiles(id) on delete set null,
  kind         text not null,
  title        text not null,
  body         text,
  href         text,
  entity_type  text,
  entity_id    uuid,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_notifications_feed
  on public.notifications(created_at desc);
create index if not exists idx_notifications_unread
  on public.notifications(audience, read_at);

-- ------------------------------------------------------------------ roles --

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.my_status()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select status from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('owner', 'partner')
      and p.status = 'active'
  );
$$;

/** An approved marketer. Pending and suspended accounts get nothing. */
create or replace function public.is_marketer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'marketer' and p.status = 'active'
  );
$$;

/** The affiliate record belonging to the signed-in marketer. */
create or replace function public.my_affiliate_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.id from public.affiliates a where a.profile_id = auth.uid() limit 1;
$$;

/** Can the caller see this project at all? */
create or replace function public.can_see_project(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
      or (
        public.is_marketer()
        and exists (
          select 1 from public.projects p
          where p.id = pid and p.open_for_affiliates and not p.archived
        )
      );
$$;

/** Cast a storage folder name to uuid without blowing up on odd paths. */
create or replace function public.safe_uuid(value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;

-- Older policies and the seed scripts still call this.
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_marketer();
$$;

-- ------------------------------------------------ new users become profiles --

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wanted_role text := coalesce(new.raw_user_meta_data ->> 'role', 'owner');
  new_status  text;
  new_profile uuid;
begin
  if wanted_role not in ('owner', 'partner', 'marketer') then
    wanted_role := 'marketer';
  end if;

  -- Marketers wait for an admin; admins are created by script and are ready.
  new_status := case when wanted_role = 'marketer' then 'pending' else 'active' end;

  insert into public.profiles (id, full_name, email, avatar_url, role, status, phone, social_url, accent)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url',
    wanted_role,
    new_status,
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'social_url',
    case when wanted_role = 'marketer' then 'indigo' else 'clay' end
  )
  on conflict (id) do nothing
  returning id into new_profile;

  -- Give every marketer the affiliate record their commissions hang off.
  if wanted_role = 'marketer' and new_profile is not null then
    insert into public.affiliates (name, email, phone, profile_id, status, commission_rate, accent)
    values (
      coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
      new.email,
      new.raw_user_meta_data ->> 'phone',
      new.id,
      'active',
      10,
      'indigo'
    )
    on conflict do nothing;

    insert into public.notifications (audience, actor_id, kind, title, body, href, entity_type, entity_id)
    values (
      'admins',
      new.id,
      'marketer.signup',
      coalesce(new.raw_user_meta_data ->> 'full_name', new.email) || ' signed up',
      'A new marketer is waiting for approval.',
      '/affiliates',
      'profile',
      new.id
    );
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------ notifications --

create or replace function public.notify_lead_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare who text;
begin
  -- Only worth a notification when a marketer submitted it.
  if new.affiliate_id is null or public.is_admin() then
    return new;
  end if;

  select a.name into who from public.affiliates a where a.id = new.affiliate_id;
  if who is null then
    return new;
  end if;

  insert into public.notifications (audience, actor_id, kind, title, body, href, entity_type, entity_id)
  values (
    'admins',
    auth.uid(),
    'lead.created',
    who || ' submitted a lead',
    new.name || coalesce(' — ' || new.company, ''),
    '/pipeline',
    'lead',
    new.id
  );
  return new;
end;
$$;

drop trigger if exists on_lead_created on public.leads;
create trigger on_lead_created
  after insert on public.leads
  for each row execute function public.notify_lead_created();

create or replace function public.notify_lead_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare who text;
begin
  if new.stage = old.stage or new.affiliate_id is null or public.is_admin() then
    return new;
  end if;

  select a.name into who from public.affiliates a where a.id = new.affiliate_id;
  if who is null then
    return new;
  end if;

  insert into public.notifications (audience, actor_id, kind, title, body, href, entity_type, entity_id)
  values (
    'admins',
    auth.uid(),
    'lead.stage',
    who || ' moved a lead to ' || new.stage,
    new.name || coalesce(' — ' || new.company, ''),
    '/pipeline',
    'lead',
    new.id
  );
  return new;
end;
$$;

drop trigger if exists on_lead_stage on public.leads;
create trigger on_lead_stage
  after update of stage on public.leads
  for each row execute function public.notify_lead_stage();

create or replace function public.notify_project_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare who text; what text;
begin
  select a.name into who from public.affiliates a where a.id = new.affiliate_id;
  select p.name into what from public.projects p where p.id = new.project_id;

  insert into public.notifications (audience, actor_id, kind, title, body, href, entity_type, entity_id)
  values (
    'admins',
    auth.uid(),
    'project.joined',
    coalesce(who, 'A marketer') || ' picked up ' || coalesce(what, 'a project'),
    null,
    '/projects/' || new.project_id,
    'project',
    new.project_id
  );
  return new;
end;
$$;

drop trigger if exists on_project_joined on public.project_marketers;
create trigger on_project_joined
  after insert on public.project_marketers
  for each row execute function public.notify_project_joined();

-- ------------------------------------------------------------------- RLS --

alter table public.project_assets    enable row level security;
alter table public.project_marketers enable row level security;
alter table public.notifications     enable row level security;

-- Admin-only tables: the whole back office.
do $$
declare t text;
begin
  foreach t in array array[
    'clients','projects','boards','board_columns','tasks','subtasks','notes',
    'goals','events','invoices','conversations','conversation_members',
    'messages','activities'
  ] loop
    execute format('drop policy if exists members_all on public.%I', t);
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format(
      'create policy admin_all on public.%I for all to authenticated
         using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- profiles ------------------------------------------------------------------
drop policy if exists members_all on public.profiles;
drop policy if exists profiles_admin_all on public.profiles;
drop policy if exists profiles_self_read on public.profiles;
drop policy if exists profiles_self_write on public.profiles;

create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Everyone can always read and edit their own row, whatever their status.
create policy profiles_self_read on public.profiles
  for select to authenticated using (id = auth.uid());

create policy profiles_self_write on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- affiliates ----------------------------------------------------------------
drop policy if exists members_all on public.affiliates;
drop policy if exists affiliates_admin_all on public.affiliates;
drop policy if exists affiliates_self on public.affiliates;

create policy affiliates_admin_all on public.affiliates
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy affiliates_self on public.affiliates
  for select to authenticated using (profile_id = auth.uid());

-- projects: marketers see only what is opened to them ------------------------
drop policy if exists projects_marketer_read on public.projects;
create policy projects_marketer_read on public.projects
  for select to authenticated
  using (public.is_marketer() and open_for_affiliates and not archived);

-- leads: a marketer owns the leads they brought in ---------------------------
drop policy if exists members_all on public.leads;
drop policy if exists leads_admin_all on public.leads;
drop policy if exists leads_marketer_own on public.leads;

create policy leads_admin_all on public.leads
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy leads_marketer_own on public.leads
  for all to authenticated
  using (public.is_marketer() and affiliate_id = public.my_affiliate_id())
  with check (public.is_marketer() and affiliate_id = public.my_affiliate_id());

-- interactions: notes on their own leads -------------------------------------
drop policy if exists members_all on public.interactions;
drop policy if exists interactions_admin_all on public.interactions;
drop policy if exists interactions_marketer_own on public.interactions;

create policy interactions_admin_all on public.interactions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy interactions_marketer_own on public.interactions
  for all to authenticated
  using (
    public.is_marketer()
    and lead_id in (select id from public.leads where affiliate_id = public.my_affiliate_id())
  )
  with check (
    public.is_marketer()
    and lead_id in (select id from public.leads where affiliate_id = public.my_affiliate_id())
  );

-- commissions: a marketer sees their own earnings ----------------------------
drop policy if exists members_all on public.commissions;
drop policy if exists commissions_admin_all on public.commissions;
drop policy if exists commissions_marketer_own on public.commissions;

create policy commissions_admin_all on public.commissions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy commissions_marketer_own on public.commissions
  for select to authenticated
  using (public.is_marketer() and affiliate_id = public.my_affiliate_id());

-- project assets -------------------------------------------------------------
drop policy if exists project_assets_admin_all on public.project_assets;
drop policy if exists project_assets_marketer_read on public.project_assets;

create policy project_assets_admin_all on public.project_assets
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy project_assets_marketer_read on public.project_assets
  for select to authenticated
  using (public.is_marketer() and public.can_see_project(project_id));

-- project marketers ----------------------------------------------------------
drop policy if exists project_marketers_admin_all on public.project_marketers;
drop policy if exists project_marketers_own on public.project_marketers;

create policy project_marketers_admin_all on public.project_marketers
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy project_marketers_own on public.project_marketers
  for all to authenticated
  using (public.is_marketer() and affiliate_id = public.my_affiliate_id())
  with check (
    public.is_marketer()
    and affiliate_id = public.my_affiliate_id()
    and public.can_see_project(project_id)
  );

-- notifications --------------------------------------------------------------
drop policy if exists notifications_admin on public.notifications;
drop policy if exists notifications_own on public.notifications;

create policy notifications_admin on public.notifications
  for all to authenticated
  using (public.is_admin() and audience = 'admins')
  with check (public.is_admin());

create policy notifications_own on public.notifications
  for all to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- --------------------------------------------------------------- storage --

insert into storage.buckets (id, name, public)
values ('project-assets', 'project-assets', false)
on conflict (id) do nothing;

drop policy if exists "project assets admin" on storage.objects;
drop policy if exists "project assets read" on storage.objects;

create policy "project assets admin" on storage.objects
  for all to authenticated
  using (bucket_id = 'project-assets' and public.is_admin())
  with check (bucket_id = 'project-assets' and public.is_admin());

-- Files live at project-assets/<project id>/<file>, so the first folder says
-- which project a file belongs to.
create policy "project assets read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'project-assets'
    and public.can_see_project(public.safe_uuid((storage.foldername(name))[1]))
  );

-- --------------------------------------------------------------- realtime --

do $$
declare t text;
begin
  foreach t in array array['notifications'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
