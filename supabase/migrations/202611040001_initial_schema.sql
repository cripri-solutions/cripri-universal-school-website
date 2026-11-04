-- CRIPRI Universal School Website
-- Initial Supabase schema. Apply only to a NEW, dedicated Supabase project.
-- Never apply this migration to any existing CRIPRI Android/Firebase project.
-- Platform approval and privileged role assignment must happen server-side.

create extension if not exists pgcrypto;

create table if not exists public.school_applications (
  id uuid primary key default gen_random_uuid(),
  school_name text not null check (length(trim(school_name)) between 2 and 180),
  contact_person text not null check (length(trim(contact_person)) between 2 and 120),
  contact_email text not null,
  contact_phone text,
  requested_slug text not null check (requested_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  message text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 180),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  motto text,
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_memberships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'school_admin' check (role in ('school_admin','content_editor')),
  created_at timestamptz not null default now(),
  unique (school_id,user_id)
);

create table if not exists public.school_content (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null unique references public.schools(id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists school_applications_status_created_idx
  on public.school_applications(status, created_at desc);
create index if not exists school_memberships_user_idx
  on public.school_memberships(user_id, school_id);

-- RLS is mandatory: no browser client receives privileged access.
alter table public.school_applications enable row level security;
alter table public.schools enable row level security;
alter table public.school_memberships enable row level security;
alter table public.school_content enable row level security;

-- Anonymous visitors may submit an application, but cannot read or approve one.
revoke all on public.school_applications from anon, authenticated;
grant insert (school_name, contact_person, contact_email, contact_phone, requested_slug, message)
  on public.school_applications to anon, authenticated;
create policy "public may submit applications"
  on public.school_applications for insert to anon, authenticated
  with check (status = 'pending' and reviewed_at is null);

-- Only active schools are publicly discoverable.
grant select on public.schools to anon, authenticated;
create policy "public can view active schools"
  on public.schools for select to anon, authenticated
  using (status = 'active');

-- Members can see only their own membership records.
grant select on public.school_memberships to authenticated;
create policy "members can view own memberships"
  on public.school_memberships for select to authenticated
  using (user_id = (select auth.uid()));

-- Helper checks the authenticated user's membership without exposing membership rows.
create or replace function public.is_school_member(target_school uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.school_memberships m
    join public.schools s on s.id = m.school_id
    where m.school_id = target_school
      and m.user_id = (select auth.uid())
      and s.status = 'active'
  );
$$;
revoke all on function public.is_school_member(uuid) from public;
grant execute on function public.is_school_member(uuid) to authenticated;

grant select on public.school_content to anon, authenticated;
create policy "public can view published content of active schools"
  on public.school_content for select to anon, authenticated
  using (
    published = true
    and exists (select 1 from public.schools s where s.id = school_id and s.status = 'active')
  );

grant insert, update, delete on public.school_content to authenticated;
create policy "school members can add content"
  on public.school_content for insert to authenticated
  with check (public.is_school_member(school_id));
create policy "school members can update content"
  on public.school_content for update to authenticated
  using (public.is_school_member(school_id))
  with check (public.is_school_member(school_id));
create policy "school members can delete content"
  on public.school_content for delete to authenticated
  using (public.is_school_member(school_id));

-- Critical boundary:
-- 1. Do not grant anon/authenticated write access to schools or memberships.
-- 2. Do not let browser users change application status or reviewed_at.
-- 3. Approval, school creation, membership assignment and suspension must be
--    implemented in a trusted server-side function using the service-role key.
-- 4. Store the service-role key only in server-side secrets, never in this repo.
-- 5. Before production, add verified email/auth flows, rate limiting, audit logs,
--    upload policies and tests for every RLS policy.
