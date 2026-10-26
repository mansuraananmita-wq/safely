-- Campus "Get help" directory. Signed-in users read active rows; only admin writes.

create table if not exists public.support_contacts (
  id text primary key,
  name_en text not null,
  name_bn text not null,
  category text not null check (category in (
    'emergency',
    'counseling',
    'women_safety',
    'legal',
    'health',
    'proctor',
    'anti_harassment_committee'
  )),
  phone text not null,
  email text not null default '',
  hours text not null default '',
  description_en text not null default '',
  description_bn text not null default '',
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create index if not exists support_contacts_active_sort on public.support_contacts (is_active, sort_order, id);

alter table public.support_contacts enable row level security;

drop policy if exists support_contacts_select on public.support_contacts;
create policy support_contacts_select on public.support_contacts for select to authenticated
  using (is_active = true or public.is_admin());

drop policy if exists support_contacts_insert on public.support_contacts;
create policy support_contacts_insert on public.support_contacts for insert to authenticated
  with check (public.is_admin());

drop policy if exists support_contacts_update on public.support_contacts;
create policy support_contacts_update on public.support_contacts for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists support_contacts_delete on public.support_contacts;
create policy support_contacts_delete on public.support_contacts for delete to authenticated
  using (public.is_admin());

grant select, insert, update, delete on public.support_contacts to authenticated;

insert into public.support_contacts (
  id, name_en, name_bn, category, phone, email, hours, description_en, description_bn, is_active, sort_order
) values
  (
    'sc-emergency-999',
    'National emergency',
    'জাতীয় জরুরি সেবা',
    'emergency',
    '999',
    '',
    '24 hours',
    'Call if someone is in danger. Safely is not an emergency service.',
    'কেউ বিপদে থাকলে কল করুন। সেইফলি জরুরি সেবা নয়।',
    true,
    10
  ),
  (
    'sc-counseling',
    'Student counseling',
    'শিক্ষার্থী কাউন্সেলিং',
    'counseling',
    '01XXXXXXXXX',
    'counseling@campus.example',
    'Sun–Thu 9:00–17:00',
    'Placeholder, replace with real campus number.',
    'Placeholder, replace with real campus number.',
    true,
    20
  ),
  (
    'sc-women-safety',
    'Women safety desk',
    'নারী নিরাপত্তা ডেস্ক',
    'women_safety',
    '01XXXXXXXXX',
    'womensafety@campus.example',
    'Sun–Thu 9:00–17:00',
    'Placeholder, replace with real campus number.',
    'Placeholder, replace with real campus number.',
    true,
    30
  ),
  (
    'sc-legal',
    'Legal aid desk',
    'আইনি সহায়তা ডেস্ক',
    'legal',
    '01XXXXXXXXX',
    'legal@campus.example',
    'Sun–Thu 9:00–17:00',
    'Placeholder, replace with real campus number.',
    'Placeholder, replace with real campus number.',
    true,
    40
  ),
  (
    'sc-health',
    'Campus medical center',
    'ক্যাম্পাস মেডিকেল সেন্টার',
    'health',
    '01XXXXXXXXX',
    'medical@campus.example',
    '24 hours',
    'Placeholder, replace with real campus number.',
    'Placeholder, replace with real campus number.',
    true,
    50
  ),
  (
    'sc-proctor',
    'Proctor office',
    'প্রক্টর অফিস',
    'proctor',
    '01XXXXXXXXX',
    'proctor@campus.example',
    'Sun–Thu 9:00–17:00',
    'Placeholder, replace with real campus number.',
    'Placeholder, replace with real campus number.',
    true,
    60
  ),
  (
    'sc-anti-harassment',
    'Anti-harassment committee',
    'হয়রানি বিরোধী কমিটি',
    'anti_harassment_committee',
    '01XXXXXXXXX',
    'ahc@campus.example',
    'Sun–Thu 9:00–17:00',
    'Placeholder, replace with real campus number.',
    'Placeholder, replace with real campus number.',
    true,
    70
  )
on conflict (id) do nothing;
