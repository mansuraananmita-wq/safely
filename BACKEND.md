# Safely backend

ওয়েবসাইট Supabase-এর সাথে যুক্ত। ফোন অ্যাপ এখনও নিজের সেশনে ডেটা রাখে।

Supabase প্রজেক্ট এই রিপোজিটরি তৈরি করে না। নিচে যে দুটি SQL ফাইল আছে, সেগুলো **SQL Editor-এ পুরোটা পেস্ট করে Run** দিতে হবে। ফাইলের ভিতরের সব লাইনই চালাতে হবে। অংশ করে কাটবেন না।

## ১. Supabase প্রজেক্ট

1. [supabase.com](https://supabase.com) এ সাইন ইন করুন।
2. **New project** দিন। নাম `safely` রাখতে পারেন। ডেটাবেস পাসওয়ার্ড সেভ করে রাখুন।
3. প্রজেক্ট তৈরি হয়ে সবুজ না হওয়া পর্যন্ত অপেক্ষা করুন।

## ২. ইমেইল কনফার্ম বন্ধ

নতুন রেজিস্ট্রেশন যেন মেইল সার্ভার ছাড়াই ঢুকতে পারে:

1. **Authentication → Sign In / Providers → Email**
2. **Confirm email** বন্ধ রাখুন।
3. Save দিন।

ডেমো অ্যাকাউন্টগুলোর ইমেইল আগে থেকেই confirmed। তাদের জন্য এই সুইচ জরুরি নয়। নতুন `@padma.edu` অ্যাকাউন্টের জন্য দরকার।

## ৩. SQL Editor-এ যা চালাবেন

**SQL Editor → New query**। একবারে একটি ফাইল। প্রথমটি সফল না হলে দ্বিতীয়টি চালাবেন না।

### প্রথমে `supabase/schema.sql`

ফাইলটি খুলে **সব লাইন** কপি করুন, SQL Editor-এ পেস্ট করুন, **Run** দিন।

এই ফাইল যা তৈরি করে:

- `places`, `departments`, `categories`
- `profiles` (Supabase Auth ইউজারের সাথে যুক্ত)
- `reports`, `report_activities`, `report_confirmations`
- `notifications`, `announcements`, `lost_found`, `audit_log`
- `public_reports` ভিউ। হয়রানি, গোপন, বেনামি, এবং safety রিপোর্ট এই ভিউতে নেই। `/status` এই ভিউ পড়ে।
- Row Level Security। কে কোন রিপোর্ট দেখতে পাবে সেটা ডেটাবেসও ঠিক রাখে।
- হয়রানির রিপোর্ট সবসময় confidential। গোপন রিপোর্ট শুধু Security (`d-sec`) বা Student Affairs (`d-affairs`)-এ বরাদ্দ হয়।
- নতুন সাইন-আপে `profiles` রো তৈরি হয়।
- `seed_demo_account(...)` ফাংশন। পরের ফাইল এটা ডাকে। পাসওয়ার্ড `padma1234`।

Run-এর পর নিচে **Success** দেখা উচিত। error এলে বার্তাটা রেখে আবার পুরো ফাইল চালান শুধু যদি লেখা থাকে যে কোনো অবজেক্ট নেই। একই ফাইল আবার চালানো যায়।

### তারপর `supabase/seed.sql`

নতুন কুয়েরি খুলুন। `supabase/seed.sql`-এর **সব লাইন** পেস্ট করে **Run** দিন।

এই ফাইল যা ভরাট করে:

- ক্যাম্পাসের জায়গা, দপ্তর, ক্যাটাগরি
- ডেমো অ্যাকাউন্ট। প্রতিটির পাসওয়ার্ড **`padma1234`**
- নমুনা রিপোর্ট, অ্যাকটিভিটি, কনফার্মেশন
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

কী না দিলে সাইট আগের মতো ব্রাউজারের `localStorage`-এ চলে। কী দিলে সাইন-ইন, রিপোর্ট, সারি, নোটিফিকেশন, অ্যালার্ট, lost and found, এবং অডিট লগ ডেটাবেসে লেখে।

## ৫. ডেমো দিয়ে দেখা

1. [http://localhost:5173/login](http://localhost:5173/login) খুলুন।
2. `admin@padma.edu` বোতামে চাপুন। পাসওয়ার্ড নিজে লিখলে `padma1234`।
3. ড্যাশবোর্ডে খোলা রিপোর্ট দেখা যাবে।
4. `amina@padma.edu` দিয়ে নিজের রিপোর্ট খুলুন।
5. `maintenance@padma.edu` দিয়ে বরাদ্দকৃত সারি দেখুন। গোপন রিপোর্ট সেখানে খুলবে না।
6. `security@padma.edu` বা `studentaffairs@padma.edu` দিয়ে সীমিত সারি দেখুন।

নতুন অ্যাকাউন্ট `@padma.edu` ইমেইলে রেজিস্ট্রেশন ফর্মের পাসওয়ার্ড ব্যবহার করে। Confirm email বন্ধ থাকলে সাথে সাথে সাইন ইন হয়।
