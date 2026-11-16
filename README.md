# Maintenance Manager – Prefab & Container Business (Namibia)

A self-hosted web app for running the maintenance side of a prefab and container
rental business: unit register and sign-outs, preventative maintenance schedules,
signed inspections, stock with supplier lead times, and fleet management with
driver pre-trip checks and service reminders.

Built for Windhoek, Namibia – works offline in the yard, installable on
Android tablets as a PWA, and optimised for touch.

## Features

- **Dashboard** – today's overview: overdue maintenance, what's due in 30 days,
  stock to reorder, fleet services due, recent inspections and email log.
- **Units** – register of containers/prefab units with contents (aircons, doors,
  windows), build team, status (in stock / at client / in maintenance), history
  timeline and per-unit maintenance schedules.
- **Maintenance** – recurring schedules by interval (aircon service, filter
  cleans, painting, inspections) with overdue tracking and responsible parties.
- **Inspections & sign-outs** – outgoing (dispatch) and return inspections with
  checklists and a required signature, updating unit status automatically.
- **QCP** – quality control plan with hold-point stages (frame, insulation,
  electrical, plumbing, painting, fit-out, final handover).
- **Stock** – inventory with reorder points, supplier lead times, bill of
  materials for a standard container build and "how many can we build".
- **Fleet** – vehicles with service intervals by km *and* months (whichever
  comes first), service/repair/tyre/incident records with costs, signed fleet
  inspections, a service-reminder panel and quick odometer updates.
- **Driver checks** – daily pre-trip walk-around that drivers complete on a
  phone: big PASS/FAIL buttons, odometer entry (kept in sync with the vehicle),
  defect notes, required signature. Failed items are flagged to the office and
  included in the reminder email.
- **Reports** – downloadable PDFs: fleet report, inspection sheets, maintenance
  plan, stock report, unit history, QCP plan.
- **Email reminders** – a digest of everything due (maintenance, stock, fleet
  services, driver-reported defects, units overdue back) sent to configurable
  recipients via SMTP, manually or on a schedule.

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS +
  shadcn/ui components
- [Prisma](https://www.prisma.io) ORM with SQLite (single-file, zero-config DB)
- [Bun](https://bun.sh) as package manager and runtime (npm/Node also work)
- PWA service worker for offline-capable install on tablets
- Client-side PDF generation with jsPDF

## Getting started

```bash
# 1. install dependencies
bun install        # or: npm install

# 2. create/update the database from the schema (SQLite, file: db/custom.db)
bun run db:push    # or: bunx prisma db push

# 3. (optional) load realistic sample data: units, vehicles, stock, templates
bun scripts/seed.ts

# 4. start the dev server on http://localhost:3000
bun run dev        # or: npm run dev
```

For production:

```bash
bun run build
bun run start      # serves the standalone build
```

### Environment

`.env` (git-ignored) only needs the database URL:

```
DATABASE_URL="file:./db/custom.db"
```

### Email reminders (optional)

Set SMTP and recipient settings in **Settings** inside the app:

- `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_from`
- `reminder_emails` – comma-separated recipients
- `reminder_days_ahead` – how far ahead to warn (default 14)

"Run reminders now" on the dashboard sends the digest immediately and logs the
result (see the Email log section on the dashboard).

### Installing on tablets (PWA)

Open the app in Chrome on Android → menu → **Install app** / **Add to Home
screen**. The service worker keeps static assets cached so the app opens
reliably on yard Wi-Fi or offline; data is stored in the SQLite database on the
server.

## Project structure

```
prisma/schema.prisma        # data model (units, inspections, stock, fleet, settings…)
scripts/seed.ts             # sample data for a fresh database
src/app/api/                # REST API routes (one folder per resource)
src/app/page.tsx            # single-page app shell + navigation
src/components/views/       # one view per section (dashboard, fleet, stock…)
src/components/             # shared forms (inspection, driver check, signature pad)
src/lib/                    # prisma client, reminder engine, PDF reports, helpers
public/sw.js                # service worker (cache-first assets, network-first pages)
```

## Driver checks & fleet service reminders in detail

1. A driver opens **Driver checks** on their phone, picks their vehicle, enters
   the current odometer and walks the 14-point checklist (licence disc, tyres,
   lights, brakes, fluids, load, extinguisher…). Anything wrong is marked FAIL
   with a note; the check is signed and saved.
2. The vehicle's odometer is updated automatically (never backwards), which
   keeps km-based service calculations accurate.
3. The office sees flagged defects in a "follow up" panel and in the reminder
   email; the fleet page shows a **Service reminders** panel listing vehicles
   OVERDUE or DUE SOON with one-tap *Log service* and *Update km* actions.

## Notes

- Sample data (units, suppliers, templates) is illustrative and grounded in the
  Namibian market; replace with your own via the UI.
- The database is a single SQLite file – back up `db/custom.db` regularly
  (it is excluded from git).
