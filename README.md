# Safely

Safely is a campus problem desk. A student, teacher, or staff member files one report. An officer assigns it to an office, and the person who filed it follows the status. Harassment and other confidential cases stay with Security or Student Affairs. Nothing is assigned on its own.

Safely is not an emergency service. If someone is in danger, call **999**. The SOS button does not dial 999.

## What it does

Campus members can:

- File a report with a category, a campus place, photos, and an optional device pin
- Follow status from submitted through review, assignment, work, resolution, and close
- Confirm someone else’s open report at the same place instead of filing a copy
- Send an SOS: a 3-second countdown, then a help message with the device’s live location to the campus desk
- Save up to five personal phone numbers that also receive the SOS text once Twilio is connected
- Read alerts, use lost and found, and switch between English and Bangla

The operations desk can:

- See open, overdue, and unassigned work
- Read SOS help messages with a map, without saving an admin phone number
- Assign a report to an office, change status, ask for information, and leave an internal note
- Open each office queue, including Facilities and Cleaning
- Manage users, categories, alerts, and the audit log

The public page `/status` shows counts for ordinary reports. Harassment, confidential, anonymous, and safety stories are left off that page and off the public campus map.

## How it is built

| Piece | Technology |
| --- | --- |
| Website | React 19, TypeScript, Vite, Tailwind CSS, React Router |
| Maps | Leaflet and OpenStreetMap for the report pin. Google Maps embed for a place, with no API key |
| Data | Supabase Postgres, Auth, and row-level security. Without the env keys, the website keeps a preview in `localStorage` |
| Phone app | Flutter, in `mobile/`. The same Supabase project when started with `run.ps1` |
| SOS texts | The Supabase Edge Function `send-sos` is deployed. SMS starts after Twilio secrets are set on the project |

Roles are student, teacher, staff, department, security, and admin. Members use `/app`. The operations admin uses `/admin`. Department officers and security use their own queue.

A confidential or harassment report can only be assigned to Security (`d-sec`) or Student Affairs (`d-affairs`).

## Run the website

```bash
npm install
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/).

`npm run test` checks the privacy rules and the SOS location message. `npm run build` typechecks and builds the site. `npm run preview` serves that build.

To use the campus database, copy `.env.example` to `.env.local` and set:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Use the anon key only. Do not put the service role key or any Twilio secret in `.env.local`. Restart the dev server after changing env. The steps for creating the Supabase project and running `supabase/schema.sql` and `supabase/seed.sql` are in [BACKEND.md](BACKEND.md).

Demo buttons on the sign-in page use the password `padma1234` when Supabase is connected. A new account can use any valid email and a password of at least 8 characters.

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
| `facilities@padma.edu` | Facilities and cleaning queue |
| `it@padma.edu` | IT queue |
| `studentaffairs@padma.edu` | Student affairs, including sensitive reports |

## Run the phone app

The phone app is for students, teachers, and staff. It signs in to the same database, lists that person’s reports, and files a new report onto the website desk.

From `mobile/`:

```powershell
powershell -File .\run.ps1
```

The script reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the website’s `.env.local` and passes them to Flutter. Those values are not written into the app source. A phone, emulator, or desktop Flutter target is required. On Windows, plugin builds need Developer Mode so Flutter can create symlinks (`start ms-settings:developers`).

`flutter run` without the script keeps sample reports in memory for that session only. Those reports do not appear on the website.

Demo people in the app are Amina Rahman, Dr. Karim Hassan, and Nusrat Jahan. With the script, those buttons sign in with `padma1234`.

## SOS

Press SOS, then wait three seconds or press Cancel. Cancel sends nothing. If the countdown finishes, the app keeps watching the device until it has a close location fix, then sends that fix. A rough network location is not treated as the live position. The campus desk sees the message and the map in the dashboard and on `/admin/sos`. Marking an alert as solved removes it from the open count on the SOS button. Saved personal numbers are optional extra SMS recipients.

One account can send one SOS per minute. 999, 112, and 911 cannot be saved as contacts.

## What still needs an outside account

These are written up in [BACKEND.md](BACKEND.md):

- Twilio, if SOS should also arrive as an SMS
- An email provider, if status changes should send mail
- FCM or APNs, if the phone should get push alerts
- A public host for the website
- Real building coordinates, when the campus supplies them

## Layout

```
src/            website
supabase/       schema.sql, seed.sql, and the send-sos function
mobile/         Flutter phone app
public/         website favicon
```
