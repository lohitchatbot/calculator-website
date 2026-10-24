# EasyCalc: two public homepage counts with Supabase

## What this measures

The homepage shows just two small aggregate counts. There is no sign-in page or visitor dashboard:

1. **Unique browsers so far:** one count per browser that accepts optional analytics and keeps its random browser ID. It is not a guaranteed count of unique people. Clearing storage, private browsing, or using another browser/device may count the same person again. Visitors who decline are not counted.
2. **Currently using the site:** distinct opted-in browsers with a heartbeat during the past 90 seconds. The homepage refreshes the aggregate counts every 10 seconds. This is an estimate; browser tabs closing, network loss, or blockers can delay updates.

Websites cannot read a visitor's MAC address. This design does not use IP or MAC addresses as identifiers. The browser creates random IDs only after consent, the Edge Function HMACs them with a server-side secret, and the database stores only the HMAC values. Supabase may process ordinary network metadata to deliver requests; EasyCalc does not save IP addresses in its analytics tables.

The homepage always fetches the two aggregate counts; that request contains no browser identifier. Declining prevents random browser/session IDs and heartbeats from being sent. Withdrawing prior consent requests deletion of the browser's visitor record and related active sessions, then removes its local IDs. If deletion requests are blocked, the record may remain; provide a site-owner contact path for deletion requests.

## Setup one step at a time

### 1. Supabase project values

The repository's `js/supabase-config.js` should contain the project URL and **publishable** key:

```js
window.EASYCALC_SUPABASE_CONFIG = Object.freeze({
  url: "https://YOUR_PROJECT_REF.supabase.co",
  publishableKey: "YOUR_PUBLISHABLE_KEY",
  collectorUrl: "",
});
```

The URL and publishable key are browser-visible project identifiers. Never put the database password, service-role key, or any secret in this file, HTML, or chat.

### 2. Allow the homepage to read only the two aggregate counts

The initial database setup (`202610240001_analytics.sql`) has already been run. Now, in Supabase **SQL Editor**, open a new query. Copy the complete contents of `supabase/migrations/202610240002_public_counts.sql` into the editor and click **Run once**. This changes the count function so anonymous homepage visitors can call it. The function returns exactly two numbers; it does not grant direct reads of visitor or session rows.

### 3. Configure and deploy the collector

Use the Supabase CLI in the repository after installing it:

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

If you already ran the SQL Editor migration, do not apply that same migration again through the CLI; use one migration path, not both.

Generate a random secret with at least 32 characters and store it only in Supabase Function secrets. Configure the exact production website origin:

```powershell
supabase secrets set SITE_ORIGIN=https://YOUR_PRODUCTION_DOMAIN `
  EASYCALC_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY `
  ANALYTICS_HASH_SECRET=YOUR_RANDOM_SECRET
```

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the Edge Function runtime. Confirm these exist in the deployed function; if not, set them in Supabase secrets. Never disclose or commit the service-role key.

Deploy the public ingestion endpoint:

```powershell
supabase functions deploy collect-analytics --no-verify-jwt
```

The collector is public so opted-in anonymous visitors can send heartbeats. It accepts only the three expected values (`visitor_id`, `session_id`, `action`), exact site Origin, configured publishable key, and four fixed actions. It HMACs IDs server-side and calls the database with the service-role credential. Browser users have no direct table read/write privileges. Origin checks and public keys are not rate limits; monitor usage and enable provider/WAF protection if needed.

### 4. Test

1. Deploy the site and open the homepage.
2. Accept optional anonymous counting. The unique count should increase; the active count should show the browser within about 90 seconds.
3. Open the homepage in another browser and accept. The unique count should rise for that browser.
4. Decline/revoke consent. That browser's active count should disappear within about 90 seconds, and withdrawal requests removal from the unique count.
5. Test the public RPC: it should return only `active_visitors` and `unique_visitors`; direct anonymous reads of either table must fail.

No live counts appear until the public-count SQL, function secrets, function deployment, and site deployment are configured. The free Supabase plan has quotas—verify current limits and monitor usage before public launch.

## Optional daily cleanup

Old session rows can be removed periodically. If Supabase Cron is enabled, schedule `public.cleanup_analytics_sessions()` daily through a secure database job. Otherwise cleanup is optional; old sessions do not count as active, because online status only counts the last 90 seconds.
