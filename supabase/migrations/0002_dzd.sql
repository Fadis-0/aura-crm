-- Algerian dinar is the workspace currency.

alter table public.projects alter column currency set default 'DZD';
alter table public.invoices alter column currency set default 'DZD';

update public.projects set currency = 'DZD' where currency = 'USD';
update public.invoices set currency = 'DZD' where currency = 'USD';
