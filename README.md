# Safely

Safely is a campus problem desk. A student, teacher, or staff member files one report. An officer assigns it to an office, and the person who filed it follows the status. Harassment and other confidential cases stay with Security or Student Affairs. Nothing is assigned on its own.

Safely is not an emergency service. If someone is in danger, call **999**. The SOS button does not dial 999.

The brand mark is the shield logo in `public/safely-logo.png` (also used as the favicon and the Flutter app icon).

## What it does

Campus members can:

- File a report with a category, a campus place, photos, and an optional device pin
- Attach photos with EXIF/GPS stripped before upload (map pin stays a separate choice); add a voice note up to 60 seconds or a video up to 30 seconds and 20 MB. Anonymous warns that faces and voices can still identify someone
- Choose Confidential and/or Anonymous on the form, with clear wording about who sees what
- Follow status from submitted through review, assignment, work, resolution, and close
- Confirm someone else’s open report at the same place instead of filing a copy
- Send an SOS: a 3-second countdown, then a help message with the device’s live location to the campus desk; if the phone is offline, open a prefilled SMS to campus security (user must press Send) or call 999
- Save up to five personal phone numbers that also receive the SOS text once Twilio is connected
- Open Get help for campus support numbers (tap-to-call), including 999
- Start a Safe Walk on the phone: pick a campus place, a 5–60 minute timer, and the desk and/or a saved contact. This does not replace 999
- On the phone, use Fake Call (delayed fake incoming call) and optional shake-to-start SOS countdown (off by default; never sends instantly)
- Read alerts, use lost and found, and switch between English and Bangla

The operations desk can:

- See open, overdue, and unassigned work
- Read SOS help messages with a map, without saving an admin phone number
- Mark SOS alerts as seen and solved; the sender sees Sent → Seen by desk → Solved
- See Safe Walks that expired without “I arrived” on `/admin/safe-walk` (shared pins clear 24 hours after close)
- Assign a report to an office, change status, ask for information, and leave an internal note
- Flag a report as invalid or malicious (anonymous reports flag the content only; the reporter stays hidden). Three flags in 30 days limit that account to 3 reports a day for 14 days. Every account is limited to 10 reports a day
- Open each office queue, including Facilities and Cleaning
- Manage users, categories, alerts, Get help contacts, and the audit log
- For a harassment or safety emergency only, request an anonymous reveal; a second admin or Student Affairs officer must approve before `reveal_reporter` returns the identity

The public page `/status` shows open and resolved counts per category and office, plus average resolution time for the last 30 days. Aggregation happens in database views. Counts under 5 appear as **fewer than 5**. Harassment, confidential, anonymous, and safety stories never contribute to those figures or to the public campus map.

### Anonymous reports

Anonymous filings keep `reports.reporter_id` empty. The private link sits in `report_identities`, which only the reporter can select. Staff screens show **Anonymous** with no name, email, or avatar. The reporter still sees the case under My reports and can reply to information requests; those replies are labeled **Reporter**, not a real name. Reveal is limited to harassment or safety emergencies and needs two desk officers: one requests in `reveal_requests`, a different admin or Student Affairs officer approves, then `reveal_reporter` returns the identity. Request, decision, and reveal are audited. My reports shows a notice if that identity was revealed.

## How it is built

| Piece | Technology |
| --- | --- |
| Website | React 19, TypeScript, Vite, Tailwind CSS, React Router |
| Maps | Leaflet and OpenStreetMap for the report pin. Google Maps embed for a place, with no API key |
| Data | Supabase Postgres, Auth, and row-level security. Without the env keys, the website keeps a preview in `localStorage` |
| Phone app | Flutter in `mobile/`. Same Supabase project when started with `run.ps1`. Home SOS matches the website |
| SOS texts | The Supabase Edge Function `send-sos` is deployed. SMS starts after Twilio secrets are set on the project |
| Brand | `public/safely-logo.png`, favicon, and Flutter launcher icons |

Roles are student, teacher, staff, department, security, and admin. Members use `/app`. The operations admin uses `/admin`. Department officers and security use their own queue.

A confidential or harassment report can only be assigned to Security (`d-sec`) or Student Affairs (`d-affairs`).

## Run the website

```bash
npm install
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/).

`npm run test` checks privacy rules, SOS helpers, image EXIF strip helpers, public count labels, and linked-database guards (rate limit, SOS RLS, anonymous reporter isolation, support_contacts write lock, public status count bucketing, reveal dual-control, Safe Walk RLS and 24-hour location cleanup, app_settings RLS, daily report caps, report media storage RLS). `npm run build` typechecks and builds the site. `npm run preview` serves that build.

To use the campus database, copy `.env.example` to `.env.local` and set:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Use the anon key only. Do not put the service role key or any Twilio secret in `.env.local`. Restart the dev server after changing env. The steps for creating the Supabase project and running `supabase/schema.sql`, `supabase/seed.sql`, and migrations are in [BACKEND.md](BACKEND.md).

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

The phone app is for students, teachers, and staff. It signs in to the same database, lists that person’s reports, files a new report onto the website desk, and sends SOS into `sos_alerts`.

From `mobile/`:

```powershell
powershell -File .\run.ps1
```

The script reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the website’s `.env.local` and passes them to Flutter. Those values are not written into the app source. A phone, emulator, or desktop Flutter target is required. On Windows, plugin builds need Developer Mode so Flutter can create symlinks (`start ms-settings:developers`).

`flutter run` without the script keeps sample reports in memory for that session only. Those reports do not appear on the website.

`flutter test` covers login smoke, SOS countdown cancel, shake-only-starts-countdown, and photo metadata strip.

Demo people in the app are Amina Rahman, Dr. Karim Hassan, and Nusrat Jahan. With the script, those buttons sign in with `padma1234`.

## SOS

Press SOS on the website or on the phone home screen. The app uses the device GPS call (on a laptop, Windows location: GPS chip or Wi-Fi). When that reading is within 1 kilometre, the pin appears on a map and a 3-second countdown starts. A city or IP reading is ignored. Cancel sends nothing. If the countdown finishes, the campus desk gets that pin. If no device reading arrives, the person can still alert the desk without a map. Offline phone sends are refused plainly and offer the 999 dialer.

The desk sees the message on the dashboard and on `/admin/sos`. A database trigger sends the SOS bell notice to **admin** and **security** only. The sender can follow Sent → Seen by desk → Solved on their own alert. Marking an alert as solved removes it from the open count on the SOS button. Members and department accounts can only read their own SOS rows. The database also enforces one SOS per minute and at most 20 per day; rejected inserts surface the server message.

Saved personal numbers are optional extra SMS recipients. 999, 112, and 911 cannot be saved as contacts. SOS never dials 999.

If the phone is offline, SOS offers **Send SMS instead**, which opens the device SMS app to `app_settings.security_sms_number` with the person’s name, last coordinates, and a Maps link. Safely does not send the text; the person presses Send. The **Call 999** button stays available. Admins edit the security number on `/admin/help`.

## Safe Walk

On the phone, Safe Walk lets someone pick a campus destination and a timer between 5 and 60 minutes, then choose the campus desk and/or a saved trusted contact. If the timer ends without **I arrived**, `expire_due_safe_walks` marks the walk expired and notifies admin and security. Optional live location is stored only when sharing is on and is wiped 24 hours after the walk closes. Owners read their own walks; the desk reads **expired** walks only. Safe Walk does not replace 999.

## What still needs an outside account

These are written up in [BACKEND.md](BACKEND.md):

- Twilio, if SOS should also arrive as an SMS
- An email provider (`EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM`), if status changes should send mail. The function skips and logs when a secret is missing
- Firebase Cloud Messaging (`FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`) and the phone app’s Firebase config, if status changes should send a push. The message is only “Your report status was updated” or “Your SOS status was updated”
- A public host for the website
- Real building coordinates, when the campus supplies them

## Layout

```
src/                 website
public/              safely-logo.png, favicon, apple-touch icon
supabase/            schema.sql, seed.sql, migrations/, send-sos, SQL tests
mobile/              Flutter phone app (SOS on home, shared sos_alerts)
```
