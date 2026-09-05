-- ===========================================================================
--  Addresses, CCP payout details, a workspace-wide document hub, and
--  notifications that reach marketers rather than only admins.
-- ===========================================================================

-- ------------------------------------------------------- address on profile --

alter table public.profiles add column if not exists wilaya text;
alter table public.profiles add column if not exists commune text;
alter table public.profiles add column if not exists address_line text;
alter table public.profiles add column if not exists postal_code text;

-- ------------------------------------------------------------- CCP payouts --
-- One payout method across the whole app: the RIP of an Algérie Poste CCP
-- account. The old free-text method/details pair is gone so nobody can record
-- a payout route the finance side does not actually support.

alter table public.affiliates add column if not exists ccp_rip text;
alter table public.affiliates add column if not exists ccp_holder text;

update public.affiliates
   set ccp_rip = nullif(trim(payout_details), '')
 where ccp_rip is null
   and payout_details is not null
   and payout_details ~ '^[0-9 ]+$';

alter table public.affiliates drop column if exists payout_method;
alter table public.affiliates drop column if exists payout_details;

-- ------------------------------------------------------------ document hub --
-- Assets are no longer tied to a project. A document with no project is an
-- internal one: admins see it, marketers never do.

alter table public.project_assets alter column project_id drop not null;
alter table public.project_assets add column if not exists tags text[] not null default '{}';

create index if not exists idx_project_assets_tags
  on public.project_assets using gin (tags);

-- --------------------------------------------------- notifications for them --

/** Reaches one person rather than the admin desk. */
create or replace function public.notify_user(
  target uuid,
  kind text,
  title text,
  body text default null,
  href text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (audience, recipient_id, kind, title, body, href)
  values ('user', target, kind, title, body, href);
$$;

-- Approved, or paused.
create or replace function public.notify_account_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role <> 'marketer' or new.status = old.status then
    return new;
  end if;

  if new.status = 'active' then
    perform public.notify_user(
      new.id,
      'account.approved',
      'Your account is approved',
      'You can pick up projects and start submitting leads.',
      '/portal/projects'
    );
  elsif new.status = 'suspended' then
    perform public.notify_user(
      new.id,
      'account.suspended',
      'Your account was paused',
      'Get in touch with an admin if you think this is a mistake.',
      '/portal'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_account_status on public.profiles;
create trigger on_account_status
  after update of status on public.profiles
  for each row execute function public.notify_account_status();

-- A project opening up is news for everyone selling.
create or replace function public.notify_project_opened()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare m record;
begin
  if new.open_for_affiliates is not true or old.open_for_affiliates is true then
    return new;
  end if;

  for m in
    select id from public.profiles where role = 'marketer' and status = 'active'
  loop
    perform public.notify_user(
      m.id,
      'project.opened',
      new.name || ' is open for affiliates',
      coalesce(new.affiliate_brief, 'Open the project to read the brief.'),
      '/portal/projects/' || new.id
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists on_project_opened on public.projects;
create trigger on_project_opened
  after update of open_for_affiliates on public.projects
  for each row execute function public.notify_project_opened();

-- Money booked, and money sent.
create or replace function public.notify_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare target uuid;
begin
  select a.profile_id into target
    from public.affiliates a where a.id = new.affiliate_id;

  if target is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    perform public.notify_user(
      target,
      'commission.earned',
      'You earned a commission',
      coalesce(new.note, 'A lead you brought in has closed.'),
      '/portal/earnings'
    );
  elsif new.status = 'paid' and old.status is distinct from 'paid' then
    perform public.notify_user(
      target,
      'commission.paid',
      'A commission was paid out',
      coalesce(new.note, 'Check your earnings for the details.'),
      '/portal/earnings'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_commission_created on public.commissions;
create trigger on_commission_created
  after insert on public.commissions
  for each row execute function public.notify_commission();

drop trigger if exists on_commission_paid on public.commissions;
create trigger on_commission_paid
  after update of status on public.commissions
  for each row execute function public.notify_commission();

-- New signups carry their address now, so put it in the admin's notification.
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
  where_from  text;
begin
  if wanted_role not in ('owner', 'partner', 'marketer') then
    wanted_role := 'marketer';
  end if;

  new_status := case when wanted_role = 'marketer' then 'pending' else 'active' end;

  insert into public.profiles (
    id, full_name, email, avatar_url, role, status, phone, social_url,
    wilaya, commune, address_line, postal_code, accent
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url',
    wanted_role,
    new_status,
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'social_url',
    new.raw_user_meta_data ->> 'wilaya',
    new.raw_user_meta_data ->> 'commune',
    new.raw_user_meta_data ->> 'address_line',
    new.raw_user_meta_data ->> 'postal_code',
    case when wanted_role = 'marketer' then 'indigo' else 'clay' end
  )
  on conflict (id) do nothing
  returning id into new_profile;

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

    where_from := nullif(
      concat_ws(', ',
        nullif(new.raw_user_meta_data ->> 'commune', ''),
        nullif(new.raw_user_meta_data ->> 'wilaya', '')
      ), '');

    insert into public.notifications (audience, actor_id, kind, title, body, href, entity_type, entity_id)
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
