# Harvest Rentals

A mobile-first agricultural machinery rental marketplace for Karnataka. Farmers search for harvesting machines by village, district, crop and machine type, then send a booking request. Owners upload a real machine photo, publish their service areas, manage availability and accept/reject requests. UI languages: English, Kannada and Hindi.

## Two supported modes

### 1. Local judge demo (no backend setup)

Leave `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` blank. The app uses browser `localStorage`, accepts demo sign-in without OTP, and keeps data on that browser/device only. Use this for an offline UI demo.

### 2. Shared Supabase mode

Data and machine photos are stored online and can be seen by other signed-in users/devices. Supabase anonymous guest sign-in is available for controlled judging; production phone sign-in uses SMS OTP.

**Do not use online demo login as production authentication.** Anonymous guest users have no account recovery. For a real public launch, use production phone OTP, configure an SMS provider, review quotas/abuse controls, and test the policies with multiple accounts.

## Setup: shared Supabase backend

1. Create a Supabase project. Use a fresh project for this schema unless your existing `machines`/`bookings` tables already match this app; the earlier hourly-rental demo schema is structurally different and is not automatically converted by this migration.
2. In Supabase Dashboard → **Authentication → Providers**, enable **Phone** for production OTP. If you need judge demo sign-in, also enable **Anonymous Sign-Ins**.
3. Open the Supabase **SQL Editor** and run the full file:
   `supabase/migrations/202610270001_harvest_rentals.sql`
4. After the migration succeeds, optionally run `supabase/tests/schema_smoke.sql` in SQL Editor to check that the tables, RLS and RPC functions exist. This is a schema smoke test, not a real multi-user test.
5. In the project root, copy `.env.example` to `.env`.
6. Add your project URL and **publishable/anon key** (never use the `service_role` key in the browser):

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
   ```

7. Choose authentication mode:
   - For a controlled judge demo with online shared data, add `VITE_DEMO_LOGIN=true`. This uses Supabase anonymous identities. Every browser session is a separate guest; it is not secure user authentication and has no recovery.
   - For real user sign-in, leave `VITE_DEMO_LOGIN` blank or set it to `false`. The app sends a phone OTP; configure the SMS provider and phone confirmation settings in Supabase first.
8. Install dependencies and run:

   ```bash
   npm install
   npm run dev
   ```

9. Test with two different browser profiles/devices: add a machine as an owner, then search for it as a farmer. Upload a real machine image and confirm it appears on the other device. Test booking, accept/reject, cancellation, blocked dates, PIN-protected removal and notifications.

## Commands

```bash
npm run dev
npm run typecheck
npm test
npm run build
npm run preview
```

## Features

- Separate farmer and owner routes and dashboards.
- Demo guest sign-in for judging; production phone OTP sign-in when Supabase is configured and `VITE_DEMO_LOGIN` is not true.
- Supabase-backed profiles, machine listings, machine contact numbers, bookings, blocked dates, notifications and machine photo storage.
- Machine photo selection from phone gallery/computer, preview, resize, upload progress, replace/remove, and visible image on farmer listing/detail pages.
- Real shared storage: a machine photo uses a Supabase Storage object path rather than a browser data URL when Supabase is configured.
- Farmer search by service village/district/state, crop and machine type; optional GPS distance sorting.
- Owner service areas, machine status, availability calendar, booking requests, accept/reject, and PIN-protected removal.
- Database RPCs validate booking state transitions and prevent two confirmed bookings for one machine on the same day.
- Row-level security policies scope profiles, listings, bookings, notifications and photo writes. Phone numbers are returned through a narrowly scoped RPC rather than being part of public listing rows.
- Browser-only fallback for offline/local demo use.
- English, Kannada and Hindi interface.

## Database and security notes

- The SQL migration is versioned and can be rerun to update policies/functions. Review it in a staging project before production.
- The `machine-photos` bucket allows public image reads so farmers can view machine photos; writes/deletes are restricted to the authenticated owner's UUID folder. Do not upload personal documents or sensitive images.
- Owner PIN is a removal confirmation step, not a replacement for account authentication. Store only the salted SHA-256 hash in the database.
- Anonymous guest mode is intended only for judging/prototyping. Use verified phone OTP or another durable identity provider for production.
- Supabase SMS OTP requires a configured SMS provider and may incur charges.
- The app has not been verified against your live Supabase project; you must run the migration and test with real accounts before deployment.
