-- ===========================================================================
--  Removing a partner used to delete the affiliate row and leave the login
--  behind: the person could still sign in, could no longer submit anything,
--  and no longer appeared anywhere an admin could fix it.
-- ===========================================================================

-- ------------------------------------------------------------- repair --
-- Give every marketer account its affiliate record back.

insert into public.affiliates (
  name, email, phone, profile_id, status, accent,
  commission_type, commission_amount, commission_rate
)
select
  p.full_name,
  p.email,
  p.phone,
  p.id,
  case when p.status = 'active' then 'active' else 'paused' end,
  'indigo',
  'fixed',
  0,
  0
from public.profiles p
where p.role = 'marketer'
  and not exists (select 1 from public.affiliates a where a.profile_id = p.id);

-- ------------------------------------------------------------- guard --
-- An affiliate row that belongs to an account cannot be deleted on its own.
-- Removing the person means removing their auth user, which cascades to the
-- profile and then to this row.

create or replace function public.block_orphaning_partner()
returns trigger
language plpgsql
as $$
begin
  if old.profile_id is not null
     and exists (select 1 from public.profiles p where p.id = old.profile_id)
  then
    raise exception
      'This partner has a sign-in account. Pause it instead, or delete the account.'
      using errcode = 'restrict_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists on_affiliate_delete on public.affiliates;
create trigger on_affiliate_delete
  before delete on public.affiliates
  for each row execute function public.block_orphaning_partner();
