# CRIPRI School Subdomain Router (Cloudflare Worker)

This Worker serves public school websites from the existing Supabase school registry. It is separate from the current School Website Manager and the main CRIPRI site.

## How routing works

- Hostnames such as telwa-girls.criprisolutions.co.ke are converted to a school slug (telwa-girls).
- The Worker reads only an active row from public.schools.
- It then reads only published rows from public.school_content_items for that school's UUID.
- It relies on Supabase's existing public RLS policies.
- It uses only the publishable/anon key. Never configure a service-role key.
- Unknown, reserved, malformed, pending, or suspended school subdomains return a 404.

## Cloudflare Worker configuration

Create a Worker named cripri-school-subdomain-router and paste worker.js.

Set these Worker environment variables:

- SUPABASE_URL: the CRIPRI Platform Supabase project URL.
- SUPABASE_ANON_KEY: the project's publishable/anon key.
- PLATFORM_DOMAIN: criprisolutions.co.ke.

Do not add the Supabase service-role key.

## DNS and route (only after verifying the apex site and mail records)

1. Add a proxied wildcard DNS record for * in the criprisolutions.co.ke zone, pointing to a valid Cloudflare-proxied target.
2. Add the Worker route *.criprisolutions.co.ke/* for this zone.
3. Do not attach the Worker to the apex domain or www; those remain reserved for the main CRIPRI website.
4. Keep existing mail records (MX, SPF, DKIM, DMARC) unchanged.

The precise wildcard DNS target must be selected after the main-domain GitHub Pages target and email configuration are confirmed. Do not guess or use a placeholder record.

## Current TELWA GIRLS slug

The existing active Supabase school row uses slug telwa-girls. Its canonical subdomain will therefore be:

https://telwa-girls.criprisolutions.co.ke

The Worker does not create or modify schools, slugs, memberships, or content. School approval and content publishing remain controlled by the existing CRIPRI application and Supabase policies.

## Smoke-test checklist

- Active school slug returns HTTP 200.
- Unknown slug returns HTTP 404.
- Reserved names such as www and admin return HTTP 404.
- Only published content for the resolved school appears.
- A suspended or pending school returns HTTP 404.
