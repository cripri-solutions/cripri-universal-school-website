# Dedicated backend setup (Supabase)

This repository contains the public website frontend. The backend is a separate service and must use a **new Supabase project dedicated to this website platform**.

## Important isolation rule

Do not connect this project to any existing CRIPRI Android, school-management, student-biometric or licence-management Firebase project. Do not change those projects, their rules, billing plans or backups.

## Current status

- The website frontend is a prototype.
- The SQL migration in `supabase/migrations/202611040001_initial_schema.sql` is a starting schema, not a deployed database.
- No Supabase project has been created or connected by this repository.
- No administrator authentication, school approval workflow, live image storage or publishing service is active yet.
- Never put a Supabase service-role key, database password or other secret in GitHub.

## Proposed first backend

Use a separate Supabase project for:
- Authentication for CRIPRI platform administrators and approved school administrators.
- PostgreSQL records for applications, schools, memberships and website content.
- Object storage for approved school logos and photographs.
- Row Level Security so school users can only manage their own school's content.
- Trusted server-side approval operations. Public users must never be able to approve themselves, create active schools, assign privileged roles or change school status.

The migration deliberately does not provide browser users write access to the schools or memberships tables. A secure server-side approval function and an audited initial platform-admin bootstrap must be implemented before onboarding real clients.

## Setup sequence

1. Create a new Supabase account/project for this website platform only. Select the free tier if it is offered and confirm the current limits and inactivity policy before relying on it for clients.
2. Choose a strong database password and keep it private. Do not send it in chat or commit it to GitHub.
3. Open the new project's SQL Editor and review the migration file before running it.
4. Apply the migration only to this new, empty project.
5. Configure authentication, email verification and rate limits.
6. Implement and test server-side CRIPRI approval, admin bootstrap and school membership provisioning.
7. Configure a private storage bucket and per-school upload policies.
8. Connect the frontend using only the project's public URL and publishable/anon key. The service-role key must remain server-side.
9. Test tenant isolation, unauthorised access, application spam, image uploads, backups and recovery before inviting any client.

## Hosting

The static frontend can be deployed separately from the database. GitHub Pages is currently used for previewing this repository; a production multi-client service should use a hosting provider whose current terms permit the intended commercial use and whose custom-domain and build limits fit the service. Hosting the HTML does not deploy the backend.

## No billing without approval

Do not enable paid plans, paid add-ons, usage upgrades or billing automatically. Before any paid change, compare the current free-tier limits with expected school count, traffic, storage, backup and uptime requirements and obtain explicit approval.

## Data minimisation

This website platform is for public school website content and authorised administrator accounts. Do not collect student records, staff records, biometrics, passwords in content fields or other sensitive school-management data through this website CMS.
