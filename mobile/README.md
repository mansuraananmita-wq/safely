# Safely mobile

Flutter phone app for campus members. Reports and SOS alerts use the same Supabase tables as the website.

## Run

From the repo root, use the campus script so `SUPABASE_URL` and `SUPABASE_ANON_KEY` are passed with `--dart-define`. Without those keys the app stays in local preview mode.

```bash
cd mobile
flutter pub get
flutter run
```

## SOS

Home shows a large SOS button, a permanent note that SOS does not call **999**, and a dialer button for 999. Flow matches the website: location permission with an explanation, GPS via `geolocator`, ignore fixes worse than 1 km, show the pin on a small map, 3-second cancelable countdown, insert into `sos_alerts`, surface server rate-limit messages, and show Sent / Seen by desk / Solved for the sender. Offline sends are refused plainly with the 999 dialer offered.

`flutter test` includes a widget test that cancels the countdown before send.
