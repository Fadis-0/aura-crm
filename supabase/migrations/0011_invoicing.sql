-- ===========================================================================
--  Printable invoices.
--
--  An invoice was a single amount, which is enough to track cash but not
--  enough to hand a client. This adds the lines that make up that amount, the
--  tax the total carries, and the issuer identity every facture has to show.
-- ===========================================================================

-- ------------------------------------------------------------ the header --

alter table public.invoices
  add column if not exists kind text not null default 'invoice'
    check (kind in ('invoice', 'receipt'));

-- Kept as a rate rather than a sum, so a corrected line still totals up.
alter table public.invoices
  add column if not exists tax_rate numeric(5,2) not null default 0;

-- ------------------------------------------------------------- the lines --

create table if not exists public.invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  description text not null default '',
  quantity    numeric(12,2) not null default 1,
  unit_price  numeric(12,2) not null default 0,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_invoice_items_invoice
  on public.invoice_items(invoice_id, position);

alter table public.invoice_items enable row level security;

drop policy if exists admin_all on public.invoice_items;
create policy admin_all on public.invoice_items
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- -------------------------------------------------------- who is billing --
-- One row, holding the details that have to appear on an Algerian facture.
-- A table rather than constants so the studio can edit them from Settings.

create table if not exists public.workspace_settings (
  id           boolean primary key default true check (id),
  legal_name   text not null default '',
  tagline      text,
  address      text,
  phone        text,
  email        text,
  website      text,
  -- Registre de commerce, and the tax identifiers a facture must carry.
  rc           text,
  nif          text,
  nis          text,
  art          text,
  -- Where the client sends the money.
  bank_details text,
  invoice_note text,
  updated_at   timestamptz not null default now()
);

insert into public.workspace_settings (id) values (true)
on conflict (id) do nothing;

alter table public.workspace_settings enable row level security;

drop policy if exists admin_all on public.workspace_settings;
create policy admin_all on public.workspace_settings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
