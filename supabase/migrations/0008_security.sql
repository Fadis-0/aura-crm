-- ===========================================================================
--  Security hardening.
--
--  Closes two privilege-escalation paths (anyone could sign up as an owner;
--  any marketer could promote themselves), stops realtime leaking admin rows
--  through delete events, and tightens the storage buckets and the columns a
--  marketer can read.
-- ===========================================================================

-- --------------------------------------------------------------- helpers --

/** True when the caller is the service key rather than a signed-in person.
 *  Seed and admin scripts run as service_role and must stay able to promote
 *  accounts; the JWT claim is absent for anything else, including anon. */
create or replace function public.is_service_role()
returns boolean
language plpgsql
stable
as $$
declare
  claims text := current_setting('request.jwt.claims', true);
begin
  if claims is null or claims = '' then
    return false;
  end if;
  return coalesce((claims::jsonb) ->> 'role', '') = 'service_role';
exception when others then
  -- Malformed or missing claims mean "not the service key".
  return false;
end;
$$;

-- ------------------------------------------------------------------- C1 --
-- New signups may not choose their own role.
--
-- raw_user_meta_data is whatever the client handed to auth.signUp, so it is
-- caller-controlled. The old version read a role out of it and defaulted to
-- 'owner', which made every public signup a full owner. Everyone now starts
-- as a pending marketer; the seed and create-user scripts promote accounts
-- afterwards with the service key, which is the only trustworthy path.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Read only to decide whether this looks like a marketer signing themselves
  -- up. It never decides privilege, so it is safe to trust for this.
  wants_marketer boolean :=
    coalesce(new.raw_user_meta_data ->> 'role', 'marketer') = 'marketer';
  new_profile uuid;
  where_from  text;
begin
  insert into public.profiles (
    id, full_name, email, avatar_url, role, status, phone, social_url,
    wilaya, commune, address_line, postal_code, accent
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url',
    'marketer',
    'pending',
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'social_url',
    new.raw_user_meta_data ->> 'wilaya',
    new.raw_user_meta_data ->> 'commune',
    new.raw_user_meta_data ->> 'address_line',
    new.raw_user_meta_data ->> 'postal_code',
    'indigo'
  )
  on conflict (id) do nothing
  returning id into new_profile;

  if wants_marketer and new_profile is not null then
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

    where_from := nullif(
      concat_ws(', ',
        nullif(new.raw_user_meta_data ->> 'commune', ''),
        nullif(new.raw_user_meta_data ->> 'wilaya', '')
      ),
      ''
    );

    insert into public.notifications (
      audience, actor_id, kind, title, body, href, entity_type, entity_id
    )
    values (
      'admins',
      new.id,
      'marketer.signup',
      coalesce(new.raw_user_meta_data ->> 'full_name', new.email) || ' signed up',
      coalesce(where_from || ' — ', '') || 'waiting for approval.',
      '/affiliates',
      'profile',
      new.id
    );
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------------- C2 --
-- A marketer may edit their own profile, but not their own privileges.
--
-- An RLS policy picks rows, not columns, so profiles_self_write let anyone
-- set role = 'owner' on their own row. Column grants cannot help here either:
-- admins are the same `authenticated` role as marketers, and they legitimately
-- update status when approving someone. So the rule lives in a trigger, which
-- can tell the two apart.

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or public.is_service_role() then
    return new;
  end if;

  if new.role <> old.role
     or new.status <> old.status
     or new.approved_at is distinct from old.approved_at
     or new.approved_by is distinct from old.approved_by then
    raise exception 'Only an admin can change a role or an account status'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists on_profile_guard on public.profiles;
create trigger on_profile_guard
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ------------------------------------------------------------------- H1 --
-- Realtime does not apply RLS to delete events, and `replica identity full`
-- puts the whole old row in the payload. Publish only what the app actually
-- subscribes to, and let deletes carry just the primary key.

do $$
declare t text;
begin
  foreach t in array array['tasks', 'activities', 'profiles', 'project_plans'] loop
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime drop table public.%I', t);
    end if;
  end loop;
end $$;

alter table public.messages replica identity default;
alter table public.tasks    replica identity default;

-- ------------------------------------------------------------------- M1 --
-- The avatars bucket let any signed-in account overwrite or delete anyone
-- else's file, and upload anything at all. Scope writes to the caller's own
-- folder; reads stay public because avatar URLs are embedded in the app.

drop policy if exists "avatars write" on storage.objects;

create policy "avatars write" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------------- M2 --
-- The attachments bucket was open to every approved marketer, with no
-- scoping, while the messages it belongs to are admin-only.

drop policy if exists "attachments rw" on storage.objects;

create policy "attachments rw" on storage.objects
  for all to authenticated
  using (bucket_id = 'attachments' and public.is_admin())
  with check (bucket_id = 'attachments' and public.is_admin());

-- ------------------------------------------------------------------- M3 --
-- RLS is row-level, so letting marketers read open projects handed them every
-- column, budget and spend included. This view is what the portal reads.

-- Deliberately NOT security_invoker: the view has to run as its owner so it
-- can bypass the base table's RLS. A security_invoker view would still need a
-- select policy on public.projects, and a marketer holding that policy could
-- simply query the base table itself and get every column back.
create or replace view public.projects_public as
  select
    id, name, code, description, accent, status, due_date,
    open_for_affiliates, affiliate_brief, affiliate_payout_note,
    created_at, updated_at
  from public.projects
  where open_for_affiliates
    and not archived
    and (public.is_admin() or public.is_marketer());

grant select on public.projects_public to authenticated;

-- With the view in place, marketers no longer read the projects table at all.
-- can_see_project() is security definer, so the policies that depend on it
-- (project_assets, project_plans, project_marketers) are unaffected.
drop policy if exists projects_marketer_read on public.projects;

-- ------------------------------------------------------------------- M7 --
-- Notifications were `for all`, so anyone could forge their own or delete the
-- ones they were meant to see. Read, and mark-as-read, is all that is needed.

drop policy if exists notifications_own on public.notifications;
drop policy if exists notifications_own_read on public.notifications;
drop policy if exists notifications_own_seen on public.notifications;

create policy notifications_own_read on public.notifications
  for select to authenticated
  using (recipient_id = auth.uid());

create policy notifications_own_seen on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- ------------------------------------------------------- payout details --
-- A marketer could not save their own CCP details at all: affiliates_self is
-- select-only, so the write failed on RLS. Giving them update on the row would
-- also hand them their own status and commission columns, so it goes through a
-- function that can only ever touch the two payout fields.

create or replace function public.set_my_payout(rip text, holder text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_marketer() then
    raise exception 'Only an approved marketer can set their payout details'
      using errcode = 'insufficient_privilege';
  end if;

  update public.affiliates
     set ccp_rip = nullif(btrim(coalesce(rip, '')), ''),
         ccp_holder = nullif(btrim(coalesce(holder, '')), '')
   where profile_id = auth.uid();
end;
$$;

revoke all on function public.set_my_payout(text, text) from public, anon;
grant execute on function public.set_my_payout(text, text) to authenticated;

-- ------------------------------------------------------------------- M6 --
-- Admin-created partners get a password their admin chose, so make them
-- replace it the first time they sign in.

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;
