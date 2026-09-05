-- ===========================================================================
--  Commission as a flat amount by default, and affiliate partners that admins
--  create with real sign-in credentials.
-- ===========================================================================

-- ------------------------------------------------------------ commission --
-- A flat fee per closed deal is the normal arrangement, so that is the
-- default. Percentage stays available for the deals that work that way.

alter table public.affiliates add column if not exists commission_type text
  not null default 'fixed';

alter table public.affiliates drop constraint if exists affiliates_commission_type_check;
alter table public.affiliates
  add constraint affiliates_commission_type_check
  check (commission_type in ('fixed', 'percent'));

alter table public.affiliates add column if not exists commission_amount numeric(12,2)
  not null default 0;

-- Existing partners were all on a percentage, so keep them there.
update public.affiliates
   set commission_type = 'percent'
 where commission_type = 'fixed'
   and commission_amount = 0
   and commission_rate > 0;

alter table public.projects add column if not exists affiliate_commission_type text
  not null default 'fixed';

alter table public.projects drop constraint if exists projects_affiliate_commission_type_check;
alter table public.projects
  add constraint projects_affiliate_commission_type_check
  check (affiliate_commission_type in ('fixed', 'percent'));

alter table public.projects add column if not exists affiliate_commission_amount numeric(12,2);

update public.projects
   set affiliate_commission_type = 'percent'
 where affiliate_commission_rate is not null
   and affiliate_commission_amount is null;

-- Commission rows record which way they were worked out.
alter table public.commissions add column if not exists commission_type text
  not null default 'fixed';

alter table public.commissions drop constraint if exists commissions_commission_type_check;
alter table public.commissions
  add constraint commissions_commission_type_check
  check (commission_type in ('fixed', 'percent'));

update public.commissions set commission_type = 'percent' where rate is not null;

-- ---------------------------------------------------------- client source --
-- Clients no longer carry a referral of their own. Attribution lives on the
-- lead that became the client, which is where it is actually earned.

alter table public.clients drop column if exists affiliate_id;

-- ------------------------------------------------- admin-created accounts --
-- An admin can now create a partner with sign-in credentials. The account is
-- active immediately: an admin vouching for someone is the approval.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wanted_role text := coalesce(new.raw_user_meta_data ->> 'role', 'owner');
  -- Set when an admin creates the account rather than someone signing up.
  created_by_admin boolean := coalesce((new.raw_user_meta_data ->> 'created_by_admin')::boolean, false);
  new_status  text;
  new_profile uuid;
  where_from  text;
begin
  if wanted_role not in ('owner', 'partner', 'marketer') then
    wanted_role := 'marketer';
  end if;

  new_status := case
    when wanted_role <> 'marketer' then 'active'
    when created_by_admin then 'active'
    else 'pending'
  end;

  insert into public.profiles (
    id, full_name, email, avatar_url, role, status, phone, social_url,
    wilaya, commune, address_line, postal_code, accent, approved_at
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
    case when wanted_role = 'marketer' then 'indigo' else 'clay' end,
    case when new_status = 'active' then now() else null end
  )
  on conflict (id) do nothing
  returning id into new_profile;

  if wanted_role = 'marketer' and new_profile is not null then
    insert into public.affiliates (
      name, email, phone, profile_id, status, accent,
      commission_type, commission_amount, commission_rate,
      ccp_rip, ccp_holder
    )
    values (
      coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
      new.email,
      new.raw_user_meta_data ->> 'phone',
      new.id,
      'active',
      'indigo',
      coalesce(new.raw_user_meta_data ->> 'commission_type', 'fixed'),
      coalesce((new.raw_user_meta_data ->> 'commission_amount')::numeric, 0),
      coalesce((new.raw_user_meta_data ->> 'commission_rate')::numeric, 0),
      new.raw_user_meta_data ->> 'ccp_rip',
      new.raw_user_meta_data ->> 'ccp_holder'
    )
    on conflict do nothing;

    -- An admin creating the account already knows about it.
    if not created_by_admin then
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
  end if;

  return new;
end;
$$;
