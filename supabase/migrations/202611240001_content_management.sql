-- CRIPRI Universal School Website: secure public content lifecycle
-- Apply to the dedicated Supabase project only after reviewing the existing schema.

create extension if not exists pgcrypto;

create table if not exists public.cripri_content_schools (
  school_id uuid primary key,
  status text not null check (status in ('ACTIVE','SUSPENDED','PENDING')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cripri_content_admins (
  school_id uuid not null references public.cripri_content_schools(school_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role = 'SCHOOL_ADMIN'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (school_id, user_id)
);

create table if not exists public.school_site_content (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.cripri_content_schools(school_id),
  content_type text not null check (content_type in ('PHOTOGRAPH','COMMUNICATION')),
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 12000),
  media_url text not null default '',
  alt_text text not null default '',
  consent_confirmed boolean not null default false,
  status text not null default 'DRAFT'
    check (status in ('DRAFT','PUBLISHED','WITHDRAWN','RECOVERY')),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint photograph_needs_media_and_consent check (
    content_type <> 'PHOTOGRAPH'
    or (media_url like 'https://%' and consent_confirmed = true)
  )
);

create index if not exists school_site_content_public_idx
  on public.school_site_content (school_id, status, updated_at desc);

create table if not exists public.school_content_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.cripri_content_schools(school_id),
  content_id uuid not null,
  actor_user_id uuid not null references auth.users(id),
  action text not null,
  content_title text not null,
  previous_status text,
  new_status text,
  occurred_at timestamptz not null default now()
);

-- Narrow SECURITY DEFINER helper lets RLS evaluate the trusted membership registry
-- without granting browser clients direct access to that registry.
create or replace function public.is_active_cripri_school_admin(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1
    from public.cripri_content_admins a
    join public.cripri_content_schools s on s.school_id = a.school_id
    where a.school_id = p_school_id
      and a.user_id = (select auth.uid())
      and a.role = 'SCHOOL_ADMIN'
      and a.active = true
      and s.status = 'ACTIVE'
  );
$;
revoke all on function public.is_active_cripri_school_admin(uuid) from public, anon;
grant execute on function public.is_active_cripri_school_admin(uuid) to authenticated;

create or replace function public.is_active_cripri_school(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1 from public.cripri_content_schools s
    where s.school_id = p_school_id and s.status = 'ACTIVE'
  );
$;
revoke all on function public.is_active_cripri_school(uuid) from public;
grant execute on function public.is_active_cripri_school(uuid) to anon, authenticated;

create index if not exists school_content_audit_school_time_idx
  on public.school_content_audit (school_id, occurred_at desc);

alter table public.cripri_content_schools enable row level security;
alter table public.cripri_content_admins enable row level security;
alter table public.school_site_content enable row level security;
alter table public.school_content_audit enable row level security;

-- School/admin mappings are provisioned by trusted CRIPRI server processes only.
revoke all on public.cripri_content_schools, public.cripri_content_admins from anon, authenticated;
grant all on public.cripri_content_schools, public.cripri_content_admins to service_role;

-- Visitors can read only published items belonging to active schools.
-- A verified school admin can read all content belonging to their own school.
drop policy if exists "public reads published active school content" on public.school_site_content;
create policy "public reads published active school content"
on public.school_site_content for select to anon, authenticated
using (
  status = 'PUBLISHED'
  and public.is_active_cripri_school(school_id)
);

drop policy if exists "school admins read own school content" on public.school_site_content;
create policy "school admins read own school content"
on public.school_site_content for select to authenticated
using (public.is_active_cripri_school_admin(school_id));

-- All changes go through the checked RPC below; no direct client writes.
revoke insert, update, delete on public.school_site_content from anon, authenticated;
grant select on public.school_site_content to anon, authenticated;

drop policy if exists "school admins read own content audit" on public.school_content_audit;
create policy "school admins read own content audit"
on public.school_content_audit for select to authenticated
using (public.is_active_cripri_school_admin(school_id));
revoke insert, update, delete on public.school_content_audit from anon, authenticated;
grant select on public.school_content_audit to authenticated;

create or replace function public.manage_school_site_content(
  p_school_id uuid,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_item public.school_site_content%rowtype;
  v_id uuid;
  v_title text;
  v_body text;
  v_type text;
  v_media text;
  v_alt text;
  v_consent boolean;
  v_next_status text;
  v_previous_status text;
  v_action_label text;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.cripri_content_admins a
    join public.cripri_content_schools s on s.school_id = a.school_id
    where a.school_id = p_school_id
      and a.user_id = v_actor
      and a.role = 'SCHOOL_ADMIN'
      and a.active = true
      and s.status = 'ACTIVE'
  ) then
    raise exception 'Only the active school administrator may manage this school content'
      using errcode = '42501';
  end if;

  if p_action = 'save' then
    v_title := nullif(btrim(p_payload->>'title'), '');
    v_body := nullif(btrim(p_payload->>'body'), '');
    v_type := upper(coalesce(p_payload->>'content_type',''));
    v_media := coalesce(p_payload->>'media_url','');
    v_alt := left(coalesce(p_payload->>'alt_text',''),300);
    v_consent := coalesce((p_payload->>'consent_confirmed')::boolean,false);

    if v_title is null or char_length(v_title)>160 then
      raise exception 'Title is required and must be at most 160 characters' using errcode='22023';
    end if;
    if v_body is null or char_length(v_body)>12000 then
      raise exception 'Description is required and must be at most 12000 characters' using errcode='22023';
    end if;
    if v_type not in ('PHOTOGRAPH','COMMUNICATION') then
      raise exception 'Unsupported content type' using errcode='22023';
    end if;
    if v_type='PHOTOGRAPH' and (v_media !~ '^https://' or not v_consent) then
      raise exception 'Photographs require an HTTPS media URL and publication permission confirmation' using errcode='22023';
    end if;

    if nullif(p_payload->>'content_id','') is null then
      insert into public.school_site_content
        (school_id,content_type,title,body,media_url,alt_text,consent_confirmed,status,created_by,updated_by)
      values
        (p_school_id,v_type,v_title,v_body,v_media,v_alt,v_consent,'DRAFT',v_actor,v_actor)
      returning * into v_item;
      v_action_label := 'CONTENT_CREATED';
    else
      v_id := (p_payload->>'content_id')::uuid;
      select * into v_item from public.school_site_content
        where id=v_id and school_id=p_school_id for update;
      if not found then raise exception 'Content not found' using errcode='P0002'; end if;
      v_previous_status := v_item.status;
      v_next_status := case when v_item.status='PUBLISHED' then 'DRAFT' else v_item.status end;
      if v_next_status='RECOVERY' then
        raise exception 'Restore this item before editing it' using errcode='22023';
      end if;
      update public.school_site_content set
        content_type=v_type,title=v_title,body=v_body,media_url=v_media,
        alt_text=v_alt,consent_confirmed=v_consent,status=v_next_status,
        updated_by=v_actor,updated_at=now()
      where id=v_id returning * into v_item;
      v_action_label := 'CONTENT_AMENDED';
    end if;

    insert into public.school_content_audit
      (school_id,content_id,actor_user_id,action,content_title,previous_status,new_status)
    values (p_school_id,v_item.id,v_actor,v_action_label,v_item.title,
      case when v_action_label='CONTENT_CREATED' then null else v_previous_status end,
      v_item.status);
    return jsonb_build_object('content_id',v_item.id,'status',v_item.status);
  end if;

  v_id := (p_payload->>'content_id')::uuid;
  select * into v_item from public.school_site_content
    where id=v_id and school_id=p_school_id for update;
  if not found then raise exception 'Content not found' using errcode='P0002'; end if;

  v_previous_status := v_item.status;
  if p_action='publish' then
    if v_item.status in ('RECOVERY','WITHDRAWN') then
      raise exception 'Restore this item before publishing' using errcode='22023';
    end if;
    if v_item.content_type='PHOTOGRAPH'
      and (not v_item.consent_confirmed or v_item.media_url !~ '^https://') then
      raise exception 'Photograph publication permission is required' using errcode='22023';
    end if;
    v_next_status := 'PUBLISHED'; v_action_label := 'CONTENT_PUBLISHED';
  elsif p_action='withdraw' then
    v_next_status := 'WITHDRAWN'; v_action_label := 'CONTENT_WITHDRAWN';
  elsif p_action='recover' then
    v_next_status := 'RECOVERY'; v_action_label := 'CONTENT_MOVED_TO_RECOVERY';
  elsif p_action='restore' then
    if v_item.status not in ('RECOVERY','WITHDRAWN') then
      raise exception 'Only withdrawn or recovery items can be restored' using errcode='22023';
    end if;
    v_next_status := 'DRAFT'; v_action_label := 'CONTENT_RESTORED_AS_DRAFT';
  elsif p_action='permanent_delete' then
    if v_item.status <> 'RECOVERY' or coalesce((p_payload->>'confirm_permanent_delete')::boolean,false) is not true then
      raise exception 'Permanent deletion requires Recovery Bin status and explicit confirmation' using errcode='22023';
    end if;
    insert into public.school_content_audit
      (school_id,content_id,actor_user_id,action,content_title,previous_status,new_status)
    values (p_school_id,v_item.id,v_actor,'CONTENT_PERMANENTLY_DELETED',v_item.title,'RECOVERY','PERMANENTLY_DELETED');
    delete from public.school_site_content where id=v_item.id;
    return jsonb_build_object('content_id',v_item.id,'status','PERMANENTLY_DELETED');
  else
    raise exception 'Unsupported content action' using errcode='22023';
  end if;

  update public.school_site_content set status=v_next_status,updated_by=v_actor,updated_at=now()
    where id=v_item.id returning * into v_item;

  insert into public.school_content_audit
    (school_id,content_id,actor_user_id,action,content_title,previous_status,new_status)
  values (p_school_id,v_item.id,v_actor,v_action_label,v_item.title,
    v_previous_status,v_next_status);

  return jsonb_build_object('content_id',v_item.id,'status',v_next_status);
end;
$$;

revoke all on function public.manage_school_site_content(uuid,text,jsonb) from public, anon;
grant execute on function public.manage_school_site_content(uuid,text,jsonb) to authenticated;
