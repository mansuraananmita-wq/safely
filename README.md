# Safely

Padma University campus problem desk. Students, teachers, and staff file a report. The operations desk assigns an office and follows the status. Sensitive cases stay with a smaller desk.

This repository is a **frontend preview**. There is no shared backend, database, or login server yet. Each app keeps its own sample data on the device.

Safely is not an emergency service. If someone is in danger, call **999**.

## What is in the repo

| App | Who it is for | Where it runs |
| --- | --- | --- |
| Website | Campus members and the operations desk | Browser, Vite + React |
| Phone app | Students, teachers, and staff | Flutter (`mobile/`) |

The two apps do not share reports. A report filed in the phone app does not appear on the website, and the other way around.

## Website

Stack: React, TypeScript, Vite, Tailwind CSS, React Router. Preview data lives in `localStorage` under `safely-preview-v1`.

```bash
npm install
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/).

`npm run build` typechecks and builds the site. `npm run preview` serves that build.

### Sign in

Demo buttons skip the password. A manual sign-in accepts any password of 8 or more characters. New accounts must use `@padma.edu`. The verification code is shown on the page. Nothing is emailed.

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

`/status` shows open counts, category bars, and the busiest places. Harassment, confidential, anonymous, and safety reports are excluded. The figures are whatever this browser has saved.

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

## Not built yet

- Supabase, PostgreSQL, Supabase Auth, Storage, and row-level security
- A real mail or push channel (in-app notification preferences are stored on the website only)
- One shared record between the website and the phone app
- Google Maps JavaScript API (the embed does not need a key)

## Layout

```
src/            website
mobile/         Flutter phone app
public/         website favicon
```
