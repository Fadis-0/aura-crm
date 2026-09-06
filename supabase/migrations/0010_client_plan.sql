-- ===========================================================================
--  What a client actually bought.
--
--  A client's project is already the project row pointing back at them, so
--  only the plan needs somewhere to live. Same shape as leads.plan_id, so a
--  won lead and a client read the same way.
-- ===========================================================================

alter table public.clients
  add column if not exists plan_id uuid
    references public.project_plans(id) on delete set null;

create index if not exists idx_clients_plan on public.clients(plan_id);
