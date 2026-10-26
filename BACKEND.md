# Safely backend

ওয়েবসাইট Supabase-এর সাথে যুক্ত। ফোন অ্যাপও একই ডেটাবেসে সাইন ইন, রিপোর্ট জমা, এবং SOS পাঠায় — `mobile/run.ps1` দিয়ে চালালে।

Supabase প্রজেক্ট এই রিপোজিটরি তৈরি করে না। নিচে যে SQL ফাইল আছে, সেগুলো **SQL Editor-এ পুরোটা পেস্ট করে Run** দিতে হবে, অথবা linked CLI দিয়ে migration চালাতে হবে। ফাইলের ভিতরের সব লাইনই চালাতে হবে। অংশ করে কাটবেন না।

## ১. Supabase প্রজেক্ট

1. [supabase.com](https://supabase.com) এ সাইন ইন করুন।
2. **New project** দিন। নাম `safely` রাখতে পারেন। ডেটাবেস পাসওয়ার্ড সেভ করে রাখুন।
3. প্রজেক্ট তৈরি হয়ে সবুজ না হওয়া পর্যন্ত অপেক্ষা করুন।

## ২. ইমেইল কনফার্ম বন্ধ

নতুন রেজিস্ট্রেশন যেন মেইল সার্ভার ছাড়াই ঢুকতে পারে:

1. **Authentication → Sign In / Providers → Email**
2. **Confirm email** বন্ধ রাখুন।
3. Save দিন।

ডেমো অ্যাকাউন্টগুলোর ইমেইল আগে থেকেই confirmed। তাদের জন্য এই সুইচ জরুরি নয়। নতুন অ্যাকাউন্ট সাথে সাথে ঢুকতে চাইলে এই সুইচ বন্ধ রাখুন।

## ৩. SQL Editor-এ যা চালাবেন

**SQL Editor → New query**। একবারে একটি ফাইল। প্রথমটি সফল না হলে দ্বিতীয়টি চালাবেন না।

নতুন প্রজেক্টে সাধারণত `schema.sql` → `seed.sql` যথেষ্ট। আগে থেকে schema চালানো প্রজেক্টে `supabase/migrations/`-এর নতুন ফাইলগুলোও চালান (অথবা পুরো `schema.sql` আবার Run — আগের ডেটা মুছে না)।

### প্রথমে `supabase/schema.sql`

ফাইলটি খুলে **সব লাইন** কপি করুন, SQL Editor-এ পেস্ট করুন, **Run** দিন।

এই ফাইল যা তৈরি করে:

- `places`, `departments`, `categories`
- `profiles` (Supabase Auth ইউজারের সাথে যুক্ত)
- `reports`, `report_activities`, `report_confirmations`
- `report_identities` — বেনামি রিপোর্টের ব্যক্তিগত যোগসূত্র; SELECT শুধু লেখকের
- `notifications`, `announcements`, `lost_found`, `audit_log`
- `support_contacts` — Get help directory; signed-in users read active rows; only admin writes
- `emergency_contacts`, `sos_alerts` (`seen_at`, `resolved_at` সহ)
- `public_reports` ভিউ। হয়রানি, গোপন, বেনামি, এবং safety রিপোর্ট এই ভিউতে নেই। `/status` এই ভিউ পড়ে।
- Row Level Security। কে কোন রিপোর্ট/SOS দেখতে পাবে সেটা ডেটাবেসও ঠিক রাখে।
- হয়রানির রিপোর্ট সবসময় confidential। বেনামি রিপোর্টেও confidential চালু এবং `reporter_id` খালি।
- গোপন রিপোর্ট শুধু Security (`d-sec`) বা Student Affairs (`d-affairs`)-এ বরাদ্দ হয়।
- SOS ইনসার্টে রেট লিমিট (৬০ সেকেন্ড / দিনে ২০) এবং অ্যাডমিন+নিরাপত্তায় বেল নোটিফিকেশন ট্রিগার।
- `notify_report_owner(...)` — স্টাফ আইডি না দেখেও রিপোর্টকারীকে নোটিস পাঠায়।
- `reveal_reporter(report_id, reason)` — শুধু অপারেশন বা শিক্ষার্থী বিষয়ক; শুধু হয়রানি/নিরাপত্তা; অডিট লগে লেখে।
- নতুন সাইন-আপে `profiles` রো তৈরি হয়।
- `seed_demo_account(...)` ফাংশন। পরের ফাইল এটা ডাকে। পাসওয়ার্ড `padma1234`।

Run-এর পর নিচে **Success** দেখা উচিত। error এলে বার্তাটা রেখে আবার পুরো ফাইল চালান শুধু যদি লেখা থাকে যে কোনো অবজেক্ট নেই। একই ফাইল আবার চালানো যায়।

### তারপর `supabase/seed.sql`

নতুন কুয়েরি খুলুন। `supabase/seed.sql`-এর **সব লাইন** পেস্ট করে **Run** দিন।

এই ফাইল যা ভরাট করে:

- ক্যাম্পাসের জায়গা, দপ্তর, ক্যাটাগরি
- ডেমো অ্যাকাউন্ট। প্রতিটির পাসওয়ার্ড **`padma1234`**
- নমুনা রিপোর্ট, অ্যাকটিভিটি, কনফার্মেশন (বেনামি SF-10508-এর পরিচয় `report_identities`-এ)
- নোটিফিকেশন, অ্যালার্ট, lost and found, অডিট লগ

| ইমেইল | ভূমিকা |
| --- | --- |
| `amina@padma.edu` | শিক্ষার্থী |
| `karim@padma.edu` | শিক্ষক |
| `nusrat@padma.edu` | কর্মকর্তা |
| `admin@padma.edu` | অপারেশন ডেস্ক |
| `security@padma.edu` | নিরাপত্তা |
| `maintenance@padma.edu` | রক্ষণাবেক্ষণ |
| `electrical@padma.edu` | বিদ্যুৎ |
| `water@padma.edu` | পানি ও স্যানিটেশন |
| `it@padma.edu` | আইটি |
| `studentaffairs@padma.edu` | শিক্ষার্থী বিষয়ক |
| `facilities@padma.edu` | পরিচ্ছন্নতা |
| `yusuf@padma.edu`, `farzana@padma.edu` | অন্য শিক্ষার্থী, কনফার্মেশনের জন্য |
| `old.test@padma.edu` | স্থগিত অ্যাকাউন্ট |

`seed.sql` আবার চালালে যে সারি আগে আছে সেটা `on conflict do nothing` দিয়ে বাদ পড়ে। ডেমো প্রোফাইল আপডেট হয়, নতুন করে ডুপ্লিকেট রিপোর্ট হয় না।

### Migrations (আগের প্রজেক্ট আপডেট)

`supabase/migrations/` ফোল্ডারে ধাপে ধাপে পরিবর্তন আছে। আগে schema চালানো থাকলে নতুন migration ফাইলগুলো SQL Editor-এ বা linked CLI দিয়ে চালান। উদাহরণ:

- `20261025184500_sos_insert_rate_limit.sql` — SOS ৬০ সেকেন্ড / দিনে ২০
- `20261025190000_sos_desk_notify_and_status.sql` — ডেস্ক নোটিফিকেশন ট্রিগার, `seen_at`, security RLS
- `20261026013000_anonymous_report_identities.sql` — `report_identities`, `reveal_reporter`, বেনামি `reporter_id` খালি
- `20261027001500_support_contacts.sql` — Get help `support_contacts` টেবিল, seed (৯৯৯ + placeholder), RLS

টেস্ট SQL: `supabase/tests/` (SOS রেট লিমিট, SOS RLS, বেনামি রিপোর্টার আইসোলেশন, support_contacts student write block)। `npm run test` linked প্রজেক্টে এগুলো চালায়।

### SQL যদি auth.users-এ আটকায়

`seed_demo_account` `auth.users` এবং `auth.identities`-এ ডেমো ইউজার বসায়। কোনো কলাম না মিললে SQL Editor লাল এরর দেখায়। এররের কলামের নাম অনুযায়ী `supabase/schema.sql`-এর `insert into auth.users` তালিকায় সেই কলাম যোগ করে **শুধু schema.sql আবার Run** দিন, তারপর seed.sql আবার Run দিন।

Service role কী ওয়েবসাইটে দেবেন না। ওয়েবসাইট শুধু anon key ব্যবহার করে।

## ৪. ওয়েবসাইটের সাথে যুক্ত করা

1. **Project Settings → API**
2. **Project URL** কপি করুন।
3. **anon public** key কপি করুন। `service_role` কী কপি করবেন না।
4. প্রজেক্টের রুটে `.env.local` বানান। `.env.example` দেখে এই দুই লাইন দিন:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

5. ডেভ সার্ভার বন্ধ করে আবার চালু করুন। Vite শুরুর সময় env পড়ে।

```bash
npm install
npm run dev
```

`.env.local` গিটে যায় না।

কী না দিলে সাইট আগের মতো ব্রাউজারের `localStorage`-এ চলে। কী দিলে সাইন-ইন, রিপোর্ট, সারি, নোটিফিকেশন, অ্যালার্ট, Get help contacts, lost and found, SOS, এবং অডিট লগ ডেটাবেসে লেখে।

ফোন অ্যাপ একই কী ব্যবহার করে। `mobile` ফোল্ডার থেকে:

```powershell
powershell -File .\run.ps1
```

স্ক্রিপ্ট `.env.local` থেকে URL ও anon key নিয়ে `flutter run` চালায়। কী কোডে লেখা থাকে না। স্ক্রিপ্ট ছাড়া চালালে অ্যাপ শুধু সেই সেশনের নমুনা ডেটা রাখে এবং ওয়েবসাইটে রিপোর্ট/SOS যায় না।

## ৫. ডেমো দিয়ে দেখা

1. [http://localhost:5173/login](http://localhost:5173/login) খুলুন।
2. `admin@padma.edu` বোতামে চাপুন। পাসওয়ার্ড নিজে লিখলে `padma1234`।
3. ড্যাশবোর্ডে খোলা রিপোর্ট দেখা যাবে।
4. `amina@padma.edu` দিয়ে নিজের রিপোর্ট ও বেনামি কেস (My reports) খুলুন।
5. `maintenance@padma.edu` দিয়ে বরাদ্দকৃত সারি দেখুন। গোপন রিপোর্ট সেখানে খুলবে না।
6. `security@padma.edu` বা `studentaffairs@padma.edu` দিয়ে সীমিত সারি দেখুন। বেনামি কেসে শুধু **Anonymous** দেখা উচিত — নাম/ইমেইল নয়।
7. ফোন অ্যাপে একই ডেমো দিয়ে হোমের বড় SOS বোতাম পরীক্ষা করুন।

নতুন অ্যাকাউন্ট যেকোনো বৈধ ইমেইল ও নিজের পাসওয়ার্ড দিয়ে রেজিস্ট্রেশন করে। Confirm email বন্ধ থাকলে সাথে সাথে সাইন ইন হয়। ডেমো বোতামগুলো আগের মতোই আছে।

## ৬. SOS

হেডারের লাল **SOS** বোতাম, `/app/sos`, অথবা ফোন অ্যাপের হোম। চাপলে ৩ সেকেন্ড গুনতি হয়। **বাতিল** চাপলে কিছু যায় না। বাতিল না করলে:

- SOS ডিভাইসের GPS কল ব্যবহার করে (ল্যাপটপে Windows লোকেশন: চিপ থাকলে GPS, না থাকলে Wi-Fi)। ১ কিলোমিটারের মধ্যে এলে পিন ম্যাপে দেখা যায়, তারপর গুনতি শুরু হয়। শহর বা আইপি লোকেশন পাঠানো হয় না।
- SOS ইনসার্ট হলে ডেটাবেস ট্রিগার **অ্যাডমিন ও নিরাপত্তা** অ্যাকাউন্টে বেল নোটিফিকেশন লেখে। ক্লায়েন্ট এড়িয়ে যেতে পারে না।
- পাঠানো ব্যক্তি নিজের SOS-এ স্ট্যাটাস দেখে: পাঠানো → ডেস্ক দেখেছে → সমাধান হয়েছে (`seen_at` / `resolved_at`)।
- ডেটাবেসেও একই অ্যাকাউন্ট থেকে ৬০ সেকেন্ডে আরেকটি SOS ঢোকে না, এবং এক দিনে সর্বোচ্চ ২০টি। সার্ভার প্রত্যাখ্যান করলে সেই বার্তা দেখায়।
- ডেস্ক **Mark as solved** চাপলে খোলা তালিকা থেকে নামে এবং হেডারের SOS সংখ্যা এক কমে।
- শিক্ষার্থী/শিক্ষক/স্টাফ/দপ্তর শুধু নিজের SOS পড়তে পারে। অ্যাডমিন ও নিরাপত্তা সব খোলা কেস পড়তে ও সমাধান চিহ্ন দিতে পারে।
- ফোন অফলাইন থাকলে SOS পাঠানো হয় না; অ্যাপ স্পষ্ট বলে এবং ৯৯৯ ডায়ালার অফার করে।
- সেভ করা নম্বর থাকলে তাদের কাছেও বার্তা যাওয়ার চেষ্টা হয়। নম্বর না থাকলেও ডেস্কের বার্তা যায়।

এই বোতাম ৯৯৯-এ কল করে না। বিপদে থাকলে নিজে ৯৯৯-এ কল করতে হবে।

নম্বর SOS পাতায় সেভ হয়। বাংলাদেশের নম্বর `01XXXXXXXXX` লেখা যায়। অন্য দেশে `+` ও কান্ট্রি কোড দিন। এক অ্যাকাউন্টে পাঁচটি নম্বর। ৯৯৯ এখানে সেভ হয় না।

### আগে SQL

SOS ও বেনামি টেবিল `supabase/schema.sql`-এ। প্রজেক্টে আগে schema চালানো থাকলে **পুরো `schema.sql` আবার Run** দিন, অথবা উপরের migration ফাইলগুলো চালান। ফাইলগুলো আগের ডেটা মুছে না। নতুন যা তৈরি হয়:

- `emergency_contacts` — নম্বর শুধু সেই অ্যাকাউন্ট দেখে
- `sos_alerts` — পাঠানোর সময়ের নম্বর ও লোকেশন; `seen_at` / `resolved_at`
- ডেস্ক নোটিফিকেশন ট্রিগার ও রেট লিমিট

### ফোন বার্তার জন্য Twilio

অ্যাপের ভেতরের ডেস্ক নোটিস Twilio ছাড়াই যায়। আসল এসএমএস যেতে Twilio লাগে। এই কী **`.env.local`-এ দেবেন না।** ওয়েবসাইটের anon key-এর সাথে এগুলো মেশাবেন না।

1. [twilio.com](https://www.twilio.com) এ অ্যাকাউন্ট খুলুন।
2. একটি ফোন নম্বর কিনুন, যেটি বাংলাদেশে SMS পাঠাতে পারে। Trial অ্যাকাউন্টে শুধু verified নম্বরে SMS যায়।
3. Console থেকে তিনটি মান নিন: **Account SID**, **Auth Token**, **ফোন নম্বর** (`+` সহ)।
4. প্রজেক্ট ফোল্ডারে টার্মিনাল খুলে এই কমান্ড দিন। মানগুলো নিজেরটা বসান। `SOS_DESK_NUMBERS` ঐচ্ছিক। না দিলে ডেস্ক শুধু অ্যাপের নোটিফিকেশন পায়। `send-sos` ফাংশন এই প্রজেক্টে আগেই ডেপ্লয় করা আছে। সিক্রেট বসালে নতুন করে ডেপ্লয় লাগে না।

```bash
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxx TWILIO_AUTH_TOKEN=your_auth_token TWILIO_FROM_NUMBER=+1xxxxxxxxxx
```

ফাংশন কোড বদলালে আবার ডেপ্লয়:

```bash
supabase functions deploy send-sos --project-ref rirqasqzdekohtqznexg
```

5. ডেপ্লয়ের পর নিজের নম্বর SOS পাতায় সেভ করে একবার পরীক্ষা করুন। ডেস্ক পাতায় স্ট্যাটাস **Texts sent** হলে SMS গেছে। **Texts waiting on Twilio** মানে কী বা ফাংশন এখনও বসানো হয়নি।

ফাংশন ফাইল: `supabase/functions/send-sos/index.ts`। এটা সাইন-ইন করা ব্যবহারকারীর নিজের SOS ছাড়া অন্য কারও বার্তা পাঠায় না।

## ৭. বেনামি রিপোর্ট

- ফর্ম বলে কে কী দেখে: স্টাফ শুধু **Anonymous**; লেখক My reports রাখে; রিপ্লাই থ্রেডে **Reporter**।
- ডেটাবেসে `reports.reporter_id` বেনামিতে `null`। যোগসূত্র `report_identities` (owner-only RLS)।
- স্টাফ `report_identities` সরাসরি SELECT করতে পারে না।
- তথ্য চাইলে `notify_report_owner` দিয়ে নোটিস যায় — আইডি স্ক্রিনে দেখায় না।
- হয়রানি বা নিরাপত্তা জরুরি অবস্থায় অপারেশন বা Student Affairs `reveal_reporter` চালায়; কারণ অডিট লগে থাকে।

## ৮. যা এখনও বাকি

এগুলো এই মেশিনের কোড দিয়ে শেষ হয় না। প্রতিটির জন্য বাইরের অ্যাকাউন্ট বা বিশ্ববিদ্যালয়ের সিদ্ধান্ত লাগে।

1. **SOS-এর SMS।** `send-sos` ফাংশন Supabase-এ ডেপ্লয় করা আছে। Twilio-এর Account SID, Auth Token, এবং পাঠানোর নম্বর এখনও বসানো হয়নি। সিক্রেট না দিলে ডেস্ক শুধু অ্যাপের ভেতরে সতর্কতা পায়। কমান্ড সেকশন ৬-এ।
2. **ইমেইল নোটিস।** প্রোফাইলে ইমেইলের সুইচ আছে। কোনো মেইল সার্ভারের কী নেই, তাই স্ট্যাটাস বদলালে ইমেইল যায় না।
3. **ফোন পুশ।** পুশ সুইচ আছে। FCM বা APNs-এর কী নেই।
4. **পাবলিক হোস্টিং।** সাইট লোকাল Vite-এ চলে। হোস্টের env-এ শুধু `VITE_SUPABASE_URL` ও `VITE_SUPABASE_ANON_KEY` দিতে হবে। `service_role` ও Twilio কী ওয়েবসাইটে দেবেন না।
5. **প্রোডাকশন ইমেইল কনফার্ম।** এখন বন্ধ, যাতে রেজিস্ট্রেশন সাথে সাথে ঢোকে। চালু করতে আগে একটি মেইল প্রোভাইডার লাগবে।
6. **ক্যাম্পাসের আসল ম্যাপ।** জায়গাগুলো ডেমো স্থানাঙ্ক। আসল ভবনের পিন বিশ্ববিদ্যালয়ের ম্যাপ থেকে বসাতে হবে।
7. **একাধিক ক্যাম্পাস।** এখন একটি ডেস্ক। আলাদা ক্যাম্পাস চাইলে বিশ্ববিদ্যালয়ের তালিকা লাগবে।
