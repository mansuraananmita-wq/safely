# Safely

Padma University campus problem desk. Students, teachers, and staff file a report. The operations desk assigns an office and follows the status. Sensitive cases stay with a smaller desk.

The website can run as a browser preview, or against a Supabase database. The phone app still keeps its own sample data for the session and does not share reports with the website.

Safely is not an emergency service. If someone is in danger, call **999**.

## What is in the repo

| App | Who it is for | Where it runs |
| --- | --- | --- |
| Website | Campus members and the operations desk | Browser, Vite + React |
| Phone app | Students, teachers, and staff | Flutter (`mobile/`) |

The two apps do not share reports. A report filed in the phone app does not appear on the website, and the other way around.

## Website

Stack: React, TypeScript, Vite, Tailwind CSS, React Router, Supabase. Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, preview data stays in `localStorage` under `safely-preview-v1`. With those values set, sign-in, reports, queues, notifications, and the audit log use the database.

```bash
npm install
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/).

`npm run build` typechecks and builds the site. `npm run preview` serves that build.

### Sign in

Demo buttons skip the password in the browser preview. Against Supabase they sign in with the password `padma1234`. A manual preview sign-in still accepts any password of 8 or more characters. New accounts must use `@padma.edu`. The preview verification code is shown on the page. Supabase registration uses the password from the form.

| Email | Role |
| --- | --- |
| `amina@padma.edu` | Student |
| `karim@padma.edu` | Teacher |
| `nusrat@padma.edu` | Staff |
| `admin@padma.edu` | Operations desk |
| `security@padma.edu` | Security, including confidential reports |
| `maintenance@padma.edu` | Maintenance queue |
| `electrical@padma.edu` | Electrical queue |
| `water@padma.edu` | Water and sanitation queue |
| `it@padma.edu` | IT queue |
| `studentaffairs@padma.edu` | Student affairs, including sensitive reports |

### Member pages

- Home, with a Google Map that follows this device’s live location
- New report: category, details, campus place, optional device pin, privacy, review
- My reports and the report page, including the pin, replies, rating, and reopen
- Campus map of ordinary open reports
- Alerts, lost and found, help, profile, in-app notifications
- English and Bangla, larger text, higher contrast

Harassment reports are always restricted. Anonymous reports hide the name from officers. In this preview the report still stays on the author’s account so they can track it. Confidential, anonymous, harassment, and safety stories are left off the public campus map and the public figures page.

### Desk pages

- Overview, report queue, filters, bulk priority, CSV export
- Review: assign an office, change status, ask for information, internal note, extend the due time
- Departments
- Users and categories (operations admin only)
- Alerts and the audit log (operations admin and security)

Nothing is assigned to a department until an officer confirms it. Confidential reports can only be assigned to Security or Student Affairs.

### Public page

`/status` shows open counts, category bars, and the busiest places. Harassment, confidential, anonymous, and safety reports are excluded. With Supabase connected, those figures come from the `public_reports` view. Otherwise they are whatever this browser has saved.

## Phone app

Flutter app in `mobile/` for campus members. It uses Material 3, `geolocator` for the live pin, and a Google Maps embed inside a web view. No Google Maps API key is required for that embed.

```bash
cd mobile
flutter pub get
flutter run
```

A phone or emulator is required. On Windows, plugin builds need Developer Mode so Flutter can create symlinks (`start ms-settings:developers`).

Sign in by tapping a demo person. Passwords are not used.

| Person | Email |
| --- | --- |
| Amina Rahman | `amina@padma.edu` |
| Dr. Karim Hassan | `karim@padma.edu` |
| Nusrat Jahan | `nusrat@padma.edu` |

The phone app includes:

- Home map that follows the device location
- File a report (category, place, and the device pin when location is allowed)
- My reports, with the pin on the report page
- Two campus alerts
- English and Bangla, and sign out

Reports stay in memory for that session. The desk, registration, lost and found, and the audit log are on the website.

## Maps

Campus buildings have fixed coordinates. Choosing a building drops that pin. “I am standing here” on the website, and the phone app’s submit action, replace it with the device location when the browser or phone allows it.

The home screen always shows a map. If location is blocked, the pin stays on campus until it is allowed. Harassment and other restricted reports are not drawn on the public campus map. People who are allowed to open the report still see its pin.

## Backend

Supabase (Postgres, Auth, and row-level security) is wired up for the website. Create a project, run the two SQL files, and add the anon key. The full steps, including exactly what to paste into the SQL Editor, are in [BACKEND.md](BACKEND.md).

Still not built:

- A mail or phone-push delivery channel (the website stores the preference and writes in-app notifications)
- The Flutter app talking to the same database
- Google Maps JavaScript API (the embed does not need a key)
- A photo storage bucket (photo names and previews are saved on the report row)

## Layout

```
src/            website
supabase/       schema.sql and seed.sql for the SQL Editor
mobile/         Flutter phone app
public/         website favicon
```
