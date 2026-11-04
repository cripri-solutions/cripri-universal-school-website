-- CRIPRI Universal School Website
-- Stage 2: role-specific school editing and publishing controls.
-- Apply only after confirming the Stage 1 schema is installed in the
-- dedicated CRIPRI Platform Supabase project. This file is NOT executed here.
-- Never apply to any CRIPRI Android/Firebase project.

-- School identity: only school_admin may edit the public name and motto.
-- Browser roles cannot change the school UUID, URL slug, status or timestamps.
revoke insert, update, delete on public.schools from anon, authenticated;
grant update (name, motto) on public.schools to authenticated;

drop policy if exists "school admins can edit school identity" on public.schools;
create policy "school admins can edit school identity"
  on public.schools for update to authenticated
  using (public.is_school_admin(id))
  with check (public.is_school_admin(id));

-- Role helper. SECURITY DEFINER avoids recursive RLS evaluation on memberships;
-- the empty search_path and schema-qualified references are intentional.
create or replace function public.is_school_admin(target_school uuid)
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
      and m.role = 'school_admin'
      and s.status = 'active'
  );
$$;
revoke all on function public.is_school_admin(uuid) from public;
grant execute on function public.is_school_admin(uuid) to authenticated;

-- Rebuild content write policies with separate editor/admin capabilities.
drop policy if exists "school members can add content" on public.school_content;
drop policy if exists "school members can update content" on public.school_content;
drop policy if exists "school members can delete content" on public.school_content;

revoke insert, update, delete on public.school_content from anon, authenticated;

-- Editors can create unpublished content only. Admins can create draft or
-- published content. Neither role can assign/change the school_id or row id.
grant insert (school_id, content) on public.school_content to authenticated;
grant insert (school_id, content, published) on public.school_content to authenticated;

create policy "school admins can add content"
  on public.school_content for insert to authenticated
  with check (public.is_school_admin(school_id));

create policy "content editors can add drafts"
  on public.school_content for insert to authenticated
  with check (
    public.is_school_member(school_id)
    and not public.is_school_admin(school_id)
    and published = false
  );

-- Both roles may edit the JSON content. Column grants prevent editors from
-- changing the published flag; admins alone may publish/unpublish.
grant update (content) on public.school_content to authenticated;
grant update (content, published) on public.school_content to authenticated;

create policy "school admins can update content and publishing"
  on public.school_content for update to authenticated
  using (public.is_school_admin(school_id))
  with check (public.is_school_admin(school_id));

create policy "content editors can update draft content"
  on public.school_content for update to authenticated
  using (
    public.is_school_member(school_id)
    and not public.is_school_admin(school_id)
    and published = false
  )
  with check (
    public.is_school_member(school_id)
    and not public.is_school_admin(school_id)
    and published = false
  );

-- Deletion is reserved for school admins. Content editors cannot delete the
-- school's content record or remove a published site.
create policy "school admins can delete content"
  on public.school_content for delete to authenticated
  using (public.is_school_admin(school_id));

-- Maintain timestamps on permitted edits.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public;

drop trigger if exists schools_set_updated_at on public.schools;
create trigger schools_set_updated_at
  before update on public.schools
  for each row execute function public.set_updated_at();

drop trigger if exists school_content_set_updated_at on public.school_content;
create trigger school_content_set_updated_at
  before update on public.school_content
  for each row execute function public.set_updated_at();

-- Still intentionally not implemented by this migration:
-- * CRIPRI approval/rejection, school activation/suspension and membership
--   assignment. These require a trusted server-side workflow.
-- * Email verification, CAPTCHA/rate limiting, audit log, file storage rules,
--   account recovery and automated tenant-isolation tests.
-- Complete those items before accepting real school data or launching.
