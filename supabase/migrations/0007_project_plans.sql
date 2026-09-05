-- ===========================================================================
--  Commission moves from the affiliate record to the project: each project
--  can offer several payment plans (a one-time sell, several subscription
--  tiers), and each plan carries its own commission. A lead is now sold
--  against a specific plan, and that is what pays the affiliate, not a
--  flat rate fixed to the partner.
-- ===========================================================================

create table if not exists public.project_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  kind text not null default 'one_time' check (kind in ('one_time', 'subscription')),
  price numeric(12,2) not null default 0,
  commission_type text not null default 'fixed' check (commission_type in ('fixed', 'percent')),
  commission_amount numeric(12,2) not null default 0,
  commission_rate numeric(5,2) not null default 0,
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.leads add column if not exists project_id uuid
  references public.projects(id) on delete set null;
alter table public.leads add column if not exists plan_id uuid
  references public.project_plans(id) on delete set null;

alter table public.commissions add column if not exists plan_id uuid
  references public.project_plans(id) on delete set null;

alter table public.project_plans enable row level security;

drop policy if exists project_plans_admin_all on public.project_plans;
drop policy if exists project_plans_marketer_read on public.project_plans;

create policy project_plans_admin_all on public.project_plans
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy project_plans_marketer_read on public.project_plans
  for select to authenticated
  using (public.is_marketer() and public.can_see_project(project_id));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'project_plans'
  ) then
    alter publication supabase_realtime add table public.project_plans;
  end if;
end $$;
