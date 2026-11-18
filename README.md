# Maintenance Manager – Prefab & Container Business (Namibia)

An offline-first app for running the maintenance side of a prefab and container
rental business: unit register and sign-outs, preventative maintenance schedules,
signed inspections, stock with supplier lead times, and fleet management with
driver pre-trip checks and service reminders.

Built for Windhoek, Namibia – works fully offline in the yard, runs as a static
site on **GitHub Pages** (no server needed), installs on Android tablets as a
PWA or **APK**, and syncs data between devices through **Firebase Firestore**
when you enable it.

## How the data layer works

- Everything you enter is stored **on the device** (IndexedDB) – the app keeps
  working with no internet at all.
- The same data is mirrored to **Firestore** (config is built into the app):
  after staff sign-in, devices sync in real time, and Firestore's offline
  cache queues changes made in the yard until connectivity returns.
- Backups are one click: **Settings → Data & sync → Download backup (JSON)**,
  restore on any other device with *Restore backup*.

## Features

- **Dashboard** – today's overview: overdue maintenance, what's due in 30 days,
  stock to reorder, fleet services due, recent inspections and digest log.
- **Units** – register of containers/prefab units with contents (aircons, doors,
  windows), build team, status (in stock / at client / in maintenance), history
  timeline and per-unit maintenance schedules.
- **Maintenance** – recurring schedules by interval (aircon service, filter
  cleans, painting, inspections) with overdue tracking and responsible parties.
- **Inspections & sign-outs** – outgoing (dispatch) and return inspections with
  checklists and a required signature, updating unit status automatically.
- **QCP** – quality control plan with hold-point stages (frame, insulation,
  doors & windows, electrical, plumbing, painting, fit-out, final handover).
- **Stock** – inventory with reorder points, supplier lead times, bill of
  materials for a standard container build and "how many can we build".
- **Fleet** – vehicles with service intervals by km *and* months (whichever
  comes first), service/repair/tyre/incident records with costs, signed fleet
  inspections, a service-reminder panel and quick odometer updates.
- **Driver checks** – daily pre-trip walk-around that drivers complete on a
  phone: big PASS/FAIL buttons, odometer entry (kept in sync with the vehicle),
  defect notes, required signature. Failed items are flagged to the office and
  included in the reminder digest.
- **Reports** – downloadable PDFs: fleet report, inspection sheets, maintenance
  plan, stock report, unit history, unit stock take, QCP plan.
- **Reminder digest** – "Build digest & email" collects everything due
  (maintenance, stock, fleet services, driver-reported defects, units overdue
  back), copies it and opens it in your email app addressed to the recipients
  configured in Settings.

## Tech stack

- [Next.js](https://nextjs.org) (App Router, static export) + TypeScript +
  Tailwind CSS + shadcn/ui components
- On-device database: IndexedDB; device-to-device sync: [Firebase](https://firebase.google.com)
  Firestore (optional, offline-persistent)
- [Bun](https://bun.sh) as package manager and runtime (npm/Node also work)
- [Capacitor](https://capacitorjs.com) wraps the same build as an Android APK
- PWA service worker for offline-capable install on tablets
- Client-side PDF generation with jsPDF

## Web app on GitHub Pages

The repo ships with a GitHub Actions workflow (`.github/workflows/pages.yml`)
that builds the static site and deploys it to Pages on every push to `main`:

**https://anetwolmarans.github.io/maintenance-manager/**

> First time: enable Pages once in the repo → *Settings → Pages → Source:
> GitHub Actions*. No secrets are required for local-mode (device-only) use.

## Android APK

`.github/workflows/apk.yml` builds a debug APK on every push:

1. GitHub repo → **Actions → Build Android APK** → latest run.
2. Download the **maintenance-manager-apk** artifact → `app-debug.apk`.
3. Copy to the tablet and tap to install (allow "install unknown apps").
   Debug APKs install fine for sideloading; build a signed release APK before
   publishing to the Play Store.

The APK is the same offline-first app – data lives on the device and syncs via
Firestore with no setup (the Firebase config is part of the app code).

## Firebase sync (built in)

The Firebase config is part of the app code (`src/lib/auth.ts`), so every
build – GitHub Pages web app and APK – syncs automatically. Staff sign in
with their staff ID and password (e.g. `juan` → `juan@mm.local`), and every
synced record is stamped with who made it. One-time console setup:

1. **Build → Firestore Database → Create database** (production mode is fine –
   see `firestore.rules` in this repo).
2. **Authentication → Sign-in method → Email/Password → Enable**.
3. **Authentication → Users → Add user** for each staff member: email
   `<staffid>@mm.local` (e.g. `juan@mm.local`), a password and optionally a
   display name (shown in the app header).
4. **Firestore → Rules** → paste `firestore.rules` → Publish.

> **Security note:** a Firebase web API key is a public identifier, not a
> secret – the rules only accept signed-in staff, so visitors without an
> account cannot read or write business data.

## Development

```bash
# 1. install dependencies
bun install        # or: npm install

# 2. start the dev server on http://localhost:3000
bun run dev        # or: npm run dev

# 3. static production build → out/
bun run build

# 4. build for the APK (writes web assets into the Capacitor project)
bun run android:sync
cd android && ./gradlew assembleDebug   # needs Java 21 + Android SDK
```

On first launch the app is empty – use **Settings → Data & sync → Load sample
data** for the Namibian demo dataset (units, suppliers, stock, QCP templates,
fleet), or just start entering your own data.

## Project structure

```
src/lib/store.ts            # on-device store (IndexedDB) + change notifications
src/lib/firebase.ts         # Firestore sync bridge (real-time, offline queue)
src/lib/api.ts              # data gateway used by all views (same API as before)
src/lib/sample-data.ts      # demo dataset loader (Settings → Load sample data)
src/lib/pdf.ts              # client-side PDF reports (jsPDF)
src/app/page.tsx            # single-page app shell + navigation
src/components/views/       # one view per section (dashboard, fleet, stock…)
src/components/             # shared forms (inspection, driver check, signature pad)
public/sw.js                # service worker (cache-first assets, network-first pages)
capacitor.config.ts         # Capacitor (APK) configuration
android/                    # Capacitor Android project (APK builds from here)
firestore.rules             # Firestore security rules
.github/workflows/          # Pages deploy + APK build pipelines
```

## Driver checks & fleet service reminders in detail

1. A driver opens **Driver checks** on their phone, picks their vehicle, enters
   the current odometer and walks the 14-point checklist (licence disc, tyres,
   lights, brakes, fluids, load, extinguisher…). Anything wrong is marked FAIL
   with a note; the check is signed and saved.
2. The vehicle's odometer is updated automatically (never backwards), which
   keeps km-based service calculations accurate.
3. The office sees flagged defects in a "follow up" panel and in the reminder
   digest; the fleet page shows a **Service reminders** panel listing vehicles
   OVERDUE or DUE SOON with one-tap *Log service* and *Update km* actions.

## Notes

- **No mail server:** the app runs entirely in the browser, so the digest is
  handed to your email client (mailto) instead of being sent by SMTP. Data and
  the digest body are also kept in the app (Settings → Email log).
- **Backups:** even with Firestore sync, export a JSON backup regularly –
  it is the fastest way to move data or recover from a mistake.
- **History:** the earlier self-hosted server version (Next.js API routes +
  Prisma/SQLite + SMTP) is preserved in the git history of this repository.
- Sample data (units, suppliers, templates) is illustrative and grounded in the
  Namibian market; replace it with your own via the UI.
