# CRIPRI School Subdomain Router (Cloudflare Worker)

This Worker serves public school websites from the existing Supabase school registry. It is separate from the current School Website Manager and the main CRIPRI website.

## School website address format

Each school uses a nested school hostname:

- TELWA GIRLS: https://telwa-girls.schools.criprisolutions.co.ke
- Another school: https://<school-slug>.schools.criprisolutions.co.ke

The main CRIPRI website hostname (including www.criprisolutions.co.ke) is not covered by this Worker route.

## How routing works

- The hostname prefix before .schools.criprisolutions.co.ke becomes the school slug.
- The Worker reads only an active row from public.schools.
- It then reads only published rows from public.school_content_items for that school's UUID.
- It relies on Supabase's existing public RLS policies.
- It uses only the publishable/anon key. Never configure a service-role key.
- Unknown, reserved, malformed, pending, or suspended school subdomains return a 404.

## Cloudflare Worker configuration

Create a Worker named cripri-school-subdomain-router and deploy cloudflare/worker.js.

Set these Worker environment variables:

- SUPABASE_URL: the CRIPRI Platform Supabase project URL.
- SUPABASE_ANON_KEY: the project's publishable/anon key.
- PLATFORM_DOMAIN: schools.criprisolutions.co.ke.

Do not add the Supabase service-role key. Keep credentials in Cloudflare Worker variables/secrets, never in GitHub.

## DNS and route (configure only after reviewing the existing CRIPRI DNS zone)

1. Add a proxied wildcard DNS record named *.schools in the cr  iprisolutions.co.ke zone, pointing to a valid Cloudflare-proxied target. The exact target must be selected based on the existing Cloudflare setup; do not guess or use a placeholder.
2. Add the Worker route *.schools.criprisolutions.co.ke/*.
3. Do not add a Worker route for *.criprisolutions.co.ke/*, the apex domain, or www.criprisolutions.co.ke. This keeps the main CRIPRI website separate.
4. Leave existing apex/www website records and all mail records (MX, SPF, DKIM, DMARC) unchanged.

The wildcard DNS record and Worker route must be configured in the CRIPRI domain's Cloudflare zone. DNS proxying must be enabled for the wildcard record so requests reach the Worker route.

## Current TELWA GIRLS slug

The existing active Supabase school row uses slug telwa-girls. Its canonical subdomain is:

https://telwa-girls.schools.criprisolutions.co.ke

The Worker does not create or modify schools, slugs, memberships, or content. School approval and content publishing remain controlled by the existing CRIPRI application and Supabase policies.

## Smoke-test checklist

- Active school slug returns HTTP 200.
- Unknown slug returns HTTP 404.
- Reserved or malformed hostnames return HTTP 404.
- www.criprisolutions.co.ke and the main CRIPRI website are not routed through this Worker.
- Only published content for the resolved school appears.
- A suspended or pending school returns HTTP 404.
