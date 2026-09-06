-- ===========================================================================
--  Announcements.
--
--  Lets an admin push a note, a link or an invoice into other people's
--  notification bells, either to everyone or to a chosen few.
-- ===========================================================================

/** Fans an announcement out to one notification row per recipient.
 *
 *  Security definer because a marketer must never be able to write into
 *  someone else's feed, and an admin writing 20 rows through RLS would be 20
 *  round trips. The admin check is the first thing it does.
 *
 *  `targets` empty or null means everyone with an active account, the caller
 *  excluded: nobody needs their own announcement back.
 */
create or replace function public.broadcast_announcement(
  title   text,
  body    text default null,
  href    text default null,
  targets uuid[] default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_title text := nullif(btrim(coalesce(title, '')), '');
  clean_body  text := nullif(btrim(coalesce(body, '')), '');
  clean_href  text := nullif(btrim(coalesce(href, '')), '');
  sent        integer;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can publish an announcement'
      using errcode = 'insufficient_privilege';
  end if;

  if clean_title is null then
    raise exception 'An announcement needs a title'
      using errcode = 'check_violation';
  end if;

  -- Anything else (javascript:, data:, protocol-relative //evil) would turn a
  -- trusted-looking bell item into someone else's page.
  if clean_href is not null
     and not (
       (clean_href like '/%' and clean_href not like '//%')
       or clean_href like 'https://%'
     ) then
    raise exception 'A link must be a path on this site or an https:// address'
      using errcode = 'check_violation';
  end if;

  insert into public.notifications (
    audience, recipient_id, actor_id, kind, title, body, href
  )
  select 'user', p.id, auth.uid(), 'announcement', clean_title, clean_body, clean_href
    from public.profiles p
   where p.status = 'active'
     and p.id <> auth.uid()
     and (targets is null or cardinality(targets) = 0 or p.id = any (targets));

  get diagnostics sent = row_count;
  return sent;
end;
$$;

revoke all on function public.broadcast_announcement(text, text, text, uuid[])
  from public, anon;
grant execute on function public.broadcast_announcement(text, text, text, uuid[])
  to authenticated;
