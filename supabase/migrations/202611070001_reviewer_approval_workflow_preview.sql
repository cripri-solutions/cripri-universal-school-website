-- CRIPRI Universal School Website
-- Stage 4: CRIPRI reviewer access and controlled application decisions.
-- PREVIEW ONLY: inspect and test before applying to the dedicated CRIPRI Platform project.
-- Requires Stages 1, 2 and 3 to be installed.
-- Never apply this to any CRIPRI Android/Firebase project.
--
-- Provision the first reviewer by inserting their existing Supabase Auth UUID
-- into public.platform_reviewers using the Supabase SQL Editor as project owner.
-- Invite/create the first school administrator in Supabase Auth BEFORE approval;
-- pass that user's Auth UUID to the approval function. Never put service keys
-- in browser code.

create or replace function public.is_platform_reviewer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_reviewers r
    where r.user_id = (select auth.uid())
      and r.active = true
  );
$$;

revoke all on function public.is_platform_reviewer() from public;
grant execute on function public.is_platform_reviewer() to authenticated;

-- Reviewers can retrieve pending applications through this function only.
-- Public and ordinary school accounts cannot read the applications table.
create or replace function public.list_pending_school_applications()
returns table (
  id uuid,
  school_name text,
  contact_person text,
  contact_email text,
  contact_phone text,
  requested_slug text,
  message text,
  school_category text,
  country text,
  region text,
  physical_address text,
  contact_role text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_reviewer() then
    raise exception 'Not authorised to review platform applications'
      using errcode = '42501';
  end if;

  return query
    select a.id, a.school_name, a.contact_person, a.contact_email,
           a.contact_phone, a.requested_slug, a.message, a.school_category,
           a.country, a.region, a.physical_address, a.contact_role, a.created_at
    from public.school_applications a
    where a.status = 'pending'
    order by a.created_at asc;
end;
$$;

revoke all on function public.list_pending_school_applications() from public;
grant execute on function public.list_pending_school_applications() to authenticated;

-- Approve or reject one pending application.
-- Approval requires a previously invited/created Auth user for the first
-- school administrator. This avoids activating a school with no owner.
create or replace function public.review_school_application(
  p_application_id uuid,
  p_decision text,
  p_reason text default null,
  p_initial_admin_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  app public.school_applications%rowtype;
  new_school_id uuid;
begin
  if not public.is_platform_reviewer() then
    raise exception 'Not authorised to review platform applications'
      using errcode = '42501';
  end if;

  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected'
      using errcode = '22023';
  end if;

  select *
    into app
    from public.school_applications
   where id = p_application_id
   for update;

  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;

  if app.status <> 'pending' then
    raise exception 'Only pending applications can be reviewed'
      using errcode = '55000';
  end if;

  if p_decision = 'approved' then
    if p_initial_admin_user_id is null then
      raise exception 'An invited school administrator is required'
        using errcode = '22023';
    end if;

    if not exists (
      select 1 from auth.users u where u.id = p_initial_admin_user_id
    ) then
      raise exception 'The supplied administrator Auth user does not exist'
        using errcode = '22023';
    end if;

    insert into public.schools (name, slug, status)
    values (app.school_name, app.requested_slug, 'active')
    returning id into new_school_id;

    insert into public.school_memberships (school_id, user_id, role)
    values (new_school_id, p_initial_admin_user_id, 'school_admin');

    insert into public.school_content (school_id, content, published)
    values (new_school_id, '{}'::jsonb, false);
  end if;

  update public.school_applications
     set status = p_decision,
         reviewed_at = now(),
         reviewed_by = (select auth.uid()),
         review_reason = nullif(trim(p_reason), '')
   where id = p_application_id;

  insert into public.application_review_audit (
    application_id, school_id, reviewer_id, decision, reason
  )
  values (
    p_application_id, new_school_id, (select auth.uid()), p_decision,
    nullif(trim(p_reason), '')
  );

  return new_school_id;
end;
$$;

revoke all on function public.review_school_application(uuid, text, text, uuid)
  from public;
grant execute on function public.review_school_application(uuid, text, text, uuid)
  to authenticated;

-- Important operational notes:
-- * The first reviewer must be provisioned manually by the project owner.
-- * Invite the initial school administrator before approving that application.
-- * A slug collision intentionally fails the whole transaction; resolve it
--   with the applicant before retrying. No automatic slug mutation is done.
-- * Schools are active on approval, but their website remains unpublished
--   until their school administrator publishes content.
-- * Add email verification, rate limiting/CAPTCHA, notification delivery,
--   audit review UI and automated RLS/function tests before public launch.
