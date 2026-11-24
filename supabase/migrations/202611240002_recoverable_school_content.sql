-- Recoverable lifecycle for the existing school_content_items table.
-- This migration deliberately integrates with schools/school_memberships;
-- it does not use the disconnected school_site_content registry.

begin;

do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.school_content_items'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
      and pg_get_constraintdef(oid) ilike '%draft%'
      and pg_get_constraintdef(oid) ilike '%published%'
      and pg_get_constraintdef(oid) ilike '%scheduled%'
      and pg_get_constraintdef(oid) ilike '%archived%'
  loop
    execute format('alter table public.school_content_items drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.school_content_items
  add constraint school_content_items_status_check
  check (status in ('draft','published','scheduled','archived','recovery'));

create table if not exists public.school_content_item_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  content_id uuid not null,
  actor_user_id uuid not null references auth.users(id),
  action text not null check (action in ('MOVED_TO_RECOVERY','RESTORED_AS_DRAFT','PERMANENTLY_DELETED')),
  content_title text not null,
  previous_status text not null,
  new_status text not null,
  occurred_at timestamptz not null default now()
);

create index if not exists school_content_item_audit_school_time_idx
  on public.school_content_item_audit (school_id, occurred_at desc);

alter table public.school_content_item_audit enable row level security;

drop policy if exists "school admins read school content item audit"
  on public.school_content_item_audit;
create policy "school admins read school content item audit"
on public.school_content_item_audit
for select to authenticated
using (
  exists (
    select 1
    from public.school_memberships m
    join public.schools s on s.id = m.school_id
    where m.school_id = school_content_item_audit.school_id
      and m.user_id = (select auth.uid())
      and m.role = 'school_admin'
      and s.status = 'active'
  )
);

revoke insert, update, delete on public.school_content_item_audit from anon, authenticated;
grant select on public.school_content_item_audit to authenticated;

-- Remove the old permanent-delete path. Deletion must now go through the
-- authenticated RPC, which records an audit event before hard deletion.
drop policy if exists "school admins can delete content items" on public.school_content_items;
revoke delete on public.school_content_items from anon, authenticated;

create or replace function public.manage_school_content_item(
  p_content_id uuid,
  p_action text,
  p_confirm_permanent_delete boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_item public.school_content_items%rowtype;
  v_next_status text;
  v_audit_action text;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_action is null or p_action not in ('recover','restore','permanent_delete') then
    raise exception 'Unsupported content action' using errcode = '22023';
  end if;

  select ci.*
    into v_item
  from public.school_content_items ci
  join public.schools s on s.id = ci.school_id
  join public.school_memberships m on m.school_id = ci.school_id
  where ci.id = p_content_id
    and m.user_id = v_actor
    and m.role = 'school_admin'
    and s.status = 'active'
  for update of ci;

  if not found then
    raise exception 'Content not found or administrator access denied' using errcode = '42501';
  end if;

  if p_action = 'recover' then
    if v_item.status = 'recovery' then
      raise exception 'This item is already in the Recovery Bin' using errcode = '22023';
    end if;
    v_next_status := 'recovery';
    v_audit_action := 'MOVED_TO_RECOVERY';

  elsif p_action = 'restore' then
    if v_item.status <> 'recovery' then
      raise exception 'Only items in the Recovery Bin can be restored' using errcode = '22023';
    end if;
    v_next_status := 'draft';
    v_audit_action := 'RESTORED_AS_DRAFT';

  else
    if v_item.status <> 'recovery' or p_confirm_permanent_delete is not true then
      raise exception 'Permanent deletion requires Recovery Bin status and explicit confirmation' using errcode = '22023';
    end if;

    insert into public.school_content_item_audit
      (school_id, content_id, actor_user_id, action, content_title, previous_status, new_status)
    values
      (v_item.school_id, v_item.id, v_actor, 'PERMANENTLY_DELETED',
       v_item.title, 'recovery', 'permanently_deleted');

    delete from public.school_content_items where id = v_item.id;
    return jsonb_build_object('content_id', v_item.id, 'status', 'permanently_deleted');
  end if;

  update public.school_content_items
    set status = v_next_status,
        publish_at = case when v_next_status = 'recovery' then null else publish_at end,
        updated_by = v_actor,
        updated_at = now()
  where id = v_item.id;

  insert into public.school_content_item_audit
    (school_id, content_id, actor_user_id, action, content_title, previous_status, new_status)
  values
    (v_item.school_id, v_item.id, v_actor, v_audit_action,
     v_item.title, v_item.status, v_next_status);

  return jsonb_build_object('content_id', v_item.id, 'status', v_next_status);
end;
$function$;

revoke all on function public.manage_school_content_item(uuid, text, boolean) from public, anon;
grant execute on function public.manage_school_content_item(uuid, text, boolean) to authenticated;

commit;
