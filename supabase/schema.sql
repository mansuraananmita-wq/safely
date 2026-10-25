-- Safely campus desk. Paste this entire file into the Supabase SQL Editor and press Run.
-- Then paste supabase/seed.sql and press Run.
-- Safe to run again: tables stay, policies are replaced.

create extension if not exists pgcrypto with schema extensions;

-- Reference data ----------------------------------------------------------

create table if not exists public.places (
  id text primary key,
  en text not null,
  bn text not null,
  short text not null,
  lat double precision not null,
  lng double precision not null
);

create table if not exists public.departments (
  id text primary key,
  en text not null,
  bn text not null,
  lead text not null,
  email text not null,
  sensitive boolean not null default false
);

create table if not exists public.categories (
  id text primary key,
  en text not null,
  bn text not null,
  hint_en text not null,
  hint_bn text not null,
  sensitive boolean not null default false,
  sla_hours integer not null,
  suggested_department_id text references public.departments (id),
  active boolean not null default true
);

-- People ------------------------------------------------------------------

create table if not exists public.profiles (
  id text primary key,
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null check (role in ('student', 'teacher', 'staff', 'department', 'security', 'admin')),
  department_id text references public.departments (id),
  unit text not null default '',
  identifier text not null default '',
  verified boolean not null default false,
  suspended boolean not null default false,
  notify_in_app boolean not null default true,
  notify_email boolean not null default true,
  notify_push boolean not null default false
);

-- Reports -----------------------------------------------------------------

create table if not exists public.reports (
  id text primary key,
  title text not null,
  description text not null default '',
  category text not null references public.categories (id),
  subcategory text,
  location_id text not null references public.places (id),
  location_detail text not null default '',
  lat double precision,
  lng double precision,
  photos jsonb not null default '[]'::jsonb,
  confidential boolean not null default false,
  anonymous boolean not null default false,
  status text not null check (status in (
    'draft', 'submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected', 'reopened'
  )),
  priority text not null check (priority in ('low', 'medium', 'high', 'urgent')),
  department_id text references public.departments (id),
  assignee text,
  reporter_id text references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  due_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  rating integer check (rating is null or rating between 1 and 5),
  feedback text,
  resolution_note text,
  resolution_photo jsonb,
  info_requested boolean not null default false,
  reject_reason text,
  blocks_access boolean not null default false,
  contact_window text not null default ''
);

create table if not exists public.report_activities (
  id text primary key,
  report_id text not null references public.reports (id) on delete cascade,
  at timestamptz not null default now(),
  actor text not null,
  visibility text not null check (visibility in ('public', 'internal')),
  kind text not null check (kind in ('system', 'reply', 'internal')),
  message text not null
);

create table if not exists public.report_confirmations (
  report_id text not null references public.reports (id) on delete cascade,
  user_id text not null references public.profiles (id) on delete cascade,
  primary key (report_id, user_id)
);

create table if not exists public.notifications (
  id text primary key,
  user_id text not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  href text not null,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  kind text check (kind is null or kind in ('received', 'assigned', 'info', 'resolved'))
);

create table if not exists public.announcements (
  id text primary key,
  title text not null,
  body text not null,
  kind text not null check (kind in ('info', 'maintenance', 'safety')),
  location_id text references public.places (id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.lost_found (
  id text primary key,
  title text not null,
  place text not null,
  detail text not null default '',
  kind text not null check (kind in ('lost', 'found')),
  contact text not null,
  reporter_id text not null references public.profiles (id),
  status text not null check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id text primary key,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  target text not null
);

create index if not exists reports_status_idx on public.reports (status);
create index if not exists reports_department_idx on public.reports (department_id);
create index if not exists reports_reporter_idx on public.reports (reporter_id);
create index if not exists activities_report_idx on public.report_activities (report_id);
create index if not exists notifications_user_idx on public.notifications (user_id);

-- Helpers. security definer so policies can read the caller's role without looping.

create or replace function public.current_profile_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where auth_user_id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where auth_user_id = auth.uid() and role = 'admin' and suspended = false
  )
$$;

create or replace function public.desk_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where auth_user_id = auth.uid() and suspended = false
$$;

create or replace function public.desk_department()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select department_id from public.profiles where auth_user_id = auth.uid() and suspended = false
$$;

create or replace function public.can_read_report(r public.reports)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.suspended = false
      and (
        (r.status = 'draft' and r.reporter_id = p.id)
        or (r.reporter_id = p.id and r.status <> 'draft')
        or p.role = 'admin'
        or (
          p.role = 'security' and (
            r.department_id = 'd-sec'
            or (
              r.department_id is null
              and (r.confidential or r.category in ('harassment', 'safety'))
            )
          )
        )
        or (
          p.department_id = 'd-affairs' and (
            r.department_id = 'd-affairs'
            or (r.department_id is null and (r.confidential or r.category = 'harassment'))
          )
        )
        or (
          p.role = 'department'
          and p.department_id is distinct from 'd-affairs'
          and r.department_id = p.department_id
          and r.confidential = false
          and r.category <> 'harassment'
          and r.status <> 'draft'
        )
        or (
          p.role in ('student', 'teacher', 'staff')
          and r.confidential = false
          and r.anonymous = false
          and r.category not in ('harassment', 'safety')
          and r.status not in ('draft', 'rejected')
        )
      )
  )
$$;

create or replace function public.can_read_internal(report_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.reports r on r.id = report_id
    where p.auth_user_id = auth.uid()
      and p.suspended = false
      and (
        p.role = 'admin'
        or p.role = 'security'
        or p.department_id = 'd-affairs'
        or (p.role = 'department' and p.department_id = r.department_id)
      )
  )
$$;

-- New sign-ups become a profile. Demo seed then renames the id.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_role text := coalesce(new.raw_user_meta_data->>'role', 'student');
begin
  if next_role not in ('student', 'teacher', 'staff', 'department', 'security', 'admin') then
    next_role := 'student';
  end if;
  insert into public.profiles (
    id, auth_user_id, name, email, role, department_id, unit, identifier, verified, suspended
  ) values (
    'u-' || substr(replace(new.id::text, '-', ''), 1, 12),
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
    new.email,
    next_role,
    nullif(new.raw_user_meta_data->>'department_id', ''),
    coalesce(new.raw_user_meta_data->>'unit', ''),
    coalesce(new.raw_user_meta_data->>'identifier', ''),
    true,
    coalesce((new.raw_user_meta_data->>'suspended')::boolean, false)
  )
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Harassment stays confidential. Only Security or Student Affairs can hold those reports.

create or replace function public.guard_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text := public.desk_role();
  actor_id text := public.current_profile_id();
begin
  if auth.uid() is null then
    return new;
  end if;
  if actor_id is null then
    raise exception 'Not signed in';
  end if;
  if new.category = 'harassment' then
    new.confidential := true;
  end if;
  if new.confidential and new.department_id is not null and new.department_id not in ('d-sec', 'd-affairs') then
    raise exception 'Confidential reports stay with Security or Student Affairs';
  end if;
  if tg_op = 'INSERT' then
    if new.reporter_id is distinct from actor_id and actor_role <> 'admin' then
      raise exception 'Reporter mismatch';
    end if;
    if new.status not in ('draft', 'submitted') and actor_role <> 'admin' then
      raise exception 'Bad status';
    end if;
    return new;
  end if;
  if actor_role = 'admin' then
    return new;
  end if;
  if not public.can_read_report(old) then
    raise exception 'Not allowed';
  end if;
  if new.department_id is distinct from old.department_id then
    raise exception 'Only the operations desk can assign a department';
  end if;
  if actor_role = 'department' and new.status is distinct from old.status and new.status not in ('in_progress', 'resolved') then
    raise exception 'That status change is not available for this account';
  end if;
  if actor_role = 'security' and new.status is distinct from old.status and new.status not in ('in_progress', 'resolved') then
    raise exception 'That status change is not available for this account';
  end if;
  if actor_role in ('student', 'teacher', 'staff') then
    if old.reporter_id is distinct from actor_id then
      raise exception 'Not allowed';
    end if;
    if new.status is distinct from old.status
      and not (old.status = 'draft' and new.status = 'submitted')
      and not (old.status in ('resolved', 'closed') and new.status = 'reopened') then
      raise exception 'That status change is not available for this account';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists reports_guard on public.reports;
create trigger reports_guard
  before insert or update on public.reports
  for each row execute function public.guard_report();

create or replace function public.guard_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role
    or new.suspended is distinct from old.suspended
    or new.department_id is distinct from old.department_id
    or new.email is distinct from old.email
    or new.verified is distinct from old.verified
    or new.auth_user_id is distinct from old.auth_user_id
    or new.id is distinct from old.id then
    raise exception 'Only operations can change access';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile();

-- Public figures. The view owner reads the tables, then only safe rows are exposed.

create or replace view public.public_reports
with (security_invoker = false) as
select
  r.id,
  r.title,
  r.description,
  r.category,
  r.subcategory,
  r.location_id,
  r.location_detail,
  r.lat,
  r.lng,
  r.status,
  r.priority,
  r.created_at,
  r.updated_at,
  r.due_at,
  r.resolved_at,
  r.closed_at,
  r.blocks_access,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'at', a.at,
        'actor', a.actor,
        'visibility', a.visibility,
        'kind', a.kind,
        'message', a.message
      )
      order by a.at
    )
    from public.report_activities a
    where a.report_id = r.id and a.visibility = 'public'
  ), '[]'::jsonb) as activities
from public.reports r
where r.confidential = false
  and r.anonymous = false
  and r.category not in ('harassment', 'safety')
  and r.status not in ('draft', 'rejected');

-- Row level security ------------------------------------------------------

alter table public.places enable row level security;
alter table public.departments enable row level security;
alter table public.categories enable row level security;
alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.report_activities enable row level security;
alter table public.report_confirmations enable row level security;
alter table public.notifications enable row level security;
alter table public.announcements enable row level security;
alter table public.lost_found enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists places_read on public.places;
create policy places_read on public.places for select to anon, authenticated using (true);
drop policy if exists departments_read on public.departments;
create policy departments_read on public.departments for select to anon, authenticated using (true);
drop policy if exists departments_update on public.departments;
create policy departments_update on public.departments for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select to anon, authenticated using (true);
drop policy if exists categories_update on public.categories;
create policy categories_update on public.categories for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (auth_user_id = auth.uid() or public.is_admin())
  with check (auth_user_id = auth.uid() or public.is_admin());

drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports for select to authenticated using (public.can_read_report(reports));
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated with check (public.current_profile_id() is not null);
drop policy if exists reports_update on public.reports;
create policy reports_update on public.reports for update to authenticated using (public.can_read_report(reports)) with check (true);
drop policy if exists reports_delete on public.reports;
create policy reports_delete on public.reports for delete to authenticated
  using (status = 'draft' and reporter_id = public.current_profile_id());

drop policy if exists activities_select on public.report_activities;
create policy activities_select on public.report_activities for select to authenticated
  using (
    exists (select 1 from public.reports r where r.id = report_id and public.can_read_report(r))
    and (visibility = 'public' or public.can_read_internal(report_id))
  );
drop policy if exists activities_insert on public.report_activities;
create policy activities_insert on public.report_activities for insert to authenticated
  with check (
    exists (select 1 from public.reports r where r.id = report_id and public.can_read_report(r))
    and (visibility = 'public' or public.can_read_internal(report_id))
  );
drop policy if exists activities_delete on public.report_activities;
create policy activities_delete on public.report_activities for delete to authenticated
  using (public.is_admin());

drop policy if exists confirmations_select on public.report_confirmations;
create policy confirmations_select on public.report_confirmations for select to authenticated
  using (exists (select 1 from public.reports r where r.id = report_id and public.can_read_report(r)));
drop policy if exists confirmations_insert on public.report_confirmations;
create policy confirmations_insert on public.report_confirmations for insert to authenticated
  with check (user_id = public.current_profile_id());

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = public.current_profile_id());
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert to authenticated
  with check (public.current_profile_id() is not null);
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = public.current_profile_id())
  with check (user_id = public.current_profile_id());

drop policy if exists announcements_read on public.announcements;
create policy announcements_read on public.announcements for select to anon, authenticated using (true);
drop policy if exists announcements_write on public.announcements;
create policy announcements_write on public.announcements for insert to authenticated
  with check (public.desk_role() in ('admin', 'security'));
drop policy if exists announcements_update on public.announcements;
create policy announcements_update on public.announcements for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists lost_read on public.lost_found;
create policy lost_read on public.lost_found for select to authenticated using (true);
drop policy if exists lost_insert on public.lost_found;
create policy lost_insert on public.lost_found for insert to authenticated
  with check (reporter_id = public.current_profile_id());
drop policy if exists lost_update on public.lost_found;
create policy lost_update on public.lost_found for update to authenticated
  using (reporter_id = public.current_profile_id() or public.is_admin())
  with check (reporter_id = public.current_profile_id() or public.is_admin());

drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select to authenticated using (public.is_admin());
drop policy if exists audit_insert on public.audit_log;
create policy audit_insert on public.audit_log for insert to authenticated
  with check (public.desk_role() in ('admin', 'security', 'department') or public.current_profile_id() is not null);

grant usage on schema public to anon, authenticated;
grant select on public.places, public.departments, public.categories, public.announcements, public.public_reports to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.reports to authenticated;
grant select, insert, delete on public.report_activities to authenticated;
grant select, insert on public.report_confirmations to authenticated;
grant select, insert, update on public.notifications to authenticated;
grant insert, update on public.announcements to authenticated;
grant select, insert, update on public.lost_found to authenticated;
grant select, insert on public.audit_log to authenticated;
grant update on public.departments, public.categories to authenticated;

-- Demo account helper used by seed.sql. Password is padma1234.

create or replace function public.seed_demo_account(
  p_auth_id uuid,
  p_profile_id text,
  p_email text,
  p_name text,
  p_role text,
  p_department text,
  p_unit text,
  p_identifier text,
  p_suspended boolean,
  p_notify_in_app boolean,
  p_notify_email boolean,
  p_notify_push boolean
) returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if exists (select 1 from public.profiles where email = p_email) then
    update public.profiles
      set id = p_profile_id,
          name = p_name,
          role = p_role,
          department_id = nullif(p_department, ''),
          unit = p_unit,
          identifier = p_identifier,
          verified = true,
          suspended = p_suspended,
          notify_in_app = p_notify_in_app,
          notify_email = p_notify_email,
          notify_push = p_notify_push
      where email = p_email;
    return;
  end if;

  if not exists (select 1 from auth.users where id = p_auth_id) then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token,
      is_sso_user, is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000',
      p_auth_id,
      'authenticated',
      'authenticated',
      p_email,
      extensions.crypt('padma1234', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'name', p_name,
        'role', p_role,
        'department_id', nullif(p_department, ''),
        'unit', p_unit,
        'identifier', p_identifier,
        'suspended', p_suspended
      ),
      now(),
      now(),
      '', '', '', '',
      '', '', '', '',
      false,
      false
    );
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      p_auth_id,
      jsonb_build_object('sub', p_auth_id::text, 'email', p_email),
      'email',
      p_email,
      now(),
      now(),
      now()
    );
  end if;

  update public.profiles
    set id = p_profile_id,
        name = p_name,
        role = p_role,
        department_id = nullif(p_department, ''),
        unit = p_unit,
        identifier = p_identifier,
        verified = true,
        suspended = p_suspended,
        notify_in_app = p_notify_in_app,
        notify_email = p_notify_email,
        notify_push = p_notify_push
    where auth_user_id = p_auth_id;
end;
$$;

revoke all on function public.seed_demo_account(uuid, text, text, text, text, text, text, text, boolean, boolean, boolean, boolean) from public, anon, authenticated;

-- Report ids are issued by the database so two people cannot take the same SF number.

create sequence if not exists public.report_id_seq as integer;

do $$
declare
  floor_id integer := 10520;
  used_id integer := 0;
  current_id integer := 1;
begin
  select coalesce(max((regexp_replace(id, '\D', '', 'g'))::integer), 0)
    into used_id
  from public.reports
  where id ~ '^SF-[0-9]+$';
  select last_value into current_id from public.report_id_seq;
  perform setval('public.report_id_seq', greatest(floor_id, used_id, current_id));
end $$;

create or replace function public.next_report_id()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_id text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  loop
    next_id := 'SF-' || nextval('public.report_id_seq')::text;
    exit when not exists (select 1 from public.reports where id = next_id);
  end loop;
  return next_id;
end;
$$;

revoke all on function public.next_report_id() from public, anon;
grant execute on function public.next_report_id() to authenticated;

-- SOS. Personal numbers stay with the owner. The alert snapshot is what the desk sees.

create table if not exists public.emergency_contacts (
  id text primary key,
  user_id text not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  created_at timestamptz not null default now(),
  unique (user_id, phone)
);

create table if not exists public.sos_alerts (
  id text primary key,
  user_id text not null references public.profiles (id) on delete cascade,
  sender_name text not null,
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  message text not null,
  contacts jsonb not null default '[]'::jsonb,
  sms_status text not null default 'pending' check (sms_status in ('pending', 'sent', 'partial', 'skipped', 'failed')),
  sms_detail text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.sos_alerts add column if not exists resolved_at timestamptz;

create index if not exists emergency_contacts_user on public.emergency_contacts (user_id);
create index if not exists sos_alerts_created on public.sos_alerts (created_at desc);
create index if not exists sos_alerts_user_created on public.sos_alerts (user_id, created_at desc);

create or replace function public.limit_emergency_contacts()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.emergency_contacts where user_id = new.user_id) >= 5 then
    raise exception 'At most 5 emergency contacts';
  end if;
  return new;
end;
$$;

drop trigger if exists emergency_contacts_limit on public.emergency_contacts;
create trigger emergency_contacts_limit
  before insert on public.emergency_contacts
  for each row execute function public.limit_emergency_contacts();

create or replace function public.limit_sos_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  owner_id text;
begin
  if actor is not null then
    select p.id into owner_id
    from public.profiles p
    where p.auth_user_id = actor;

    if owner_id is null then
      raise exception 'Not signed in';
    end if;

    if new.user_id is distinct from owner_id then
      raise exception 'SOS sender mismatch';
    end if;

    if exists (
      select 1
      from public.sos_alerts s
      join public.profiles p on p.id = s.user_id
      where p.auth_user_id = actor
        and s.created_at > now() - interval '60 seconds'
    ) then
      raise exception 'Wait a minute before sending another SOS';
    end if;

    if (
      select count(*)::int
      from public.sos_alerts s
      join public.profiles p on p.id = s.user_id
      where p.auth_user_id = actor
        and s.created_at >= date_trunc('day', timezone('utc', now()))
    ) >= 20 then
      raise exception 'Daily SOS limit reached (20). Try again tomorrow.';
    end if;
  else
    if exists (
      select 1
      from public.sos_alerts
      where user_id = new.user_id
        and created_at > now() - interval '60 seconds'
    ) then
      raise exception 'Wait a minute before sending another SOS';
    end if;

    if (
      select count(*)::int
      from public.sos_alerts
      where user_id = new.user_id
        and created_at >= date_trunc('day', timezone('utc', now()))
    ) >= 20 then
      raise exception 'Daily SOS limit reached (20). Try again tomorrow.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists sos_alerts_limit_insert on public.sos_alerts;
create trigger sos_alerts_limit_insert
  before insert on public.sos_alerts
  for each row execute function public.limit_sos_insert();

create or replace function public.guard_sos_alert()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.sender_name is distinct from old.sender_name
    or new.contacts is distinct from old.contacts
    or new.created_at is distinct from old.created_at
    or new.id is distinct from old.id then
    raise exception 'An SOS alert cannot be rewritten';
  end if;
  if new.resolved_at is distinct from old.resolved_at then
    if auth.uid() is not null and not (public.is_admin() or public.desk_role() = 'security') then
      raise exception 'Only the desk can close an SOS';
    end if;
  end if;
  if new.lat is distinct from old.lat
    or new.lng is distinct from old.lng
    or new.accuracy_m is distinct from old.accuracy_m
    or new.message is distinct from old.message then
    if public.current_profile_id() is distinct from old.user_id then
      raise exception 'Only the sender can update the live location';
    end if;
    if old.resolved_at is not null then
      raise exception 'A solved SOS keeps its last location';
    end if;
    if old.created_at < now() - interval '3 minutes' then
      raise exception 'The live location window has closed';
    end if;
    if old.accuracy_m is not null and (new.accuracy_m is null or new.accuracy_m > old.accuracy_m) then
      raise exception 'A later fix must be closer';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sos_alerts_guard on public.sos_alerts;
create trigger sos_alerts_guard
  before update on public.sos_alerts
  for each row execute function public.guard_sos_alert();

alter table public.emergency_contacts enable row level security;
alter table public.sos_alerts enable row level security;

drop policy if exists emergency_contacts_select on public.emergency_contacts;
create policy emergency_contacts_select on public.emergency_contacts for select to authenticated
  using (user_id = public.current_profile_id());
drop policy if exists emergency_contacts_insert on public.emergency_contacts;
create policy emergency_contacts_insert on public.emergency_contacts for insert to authenticated
  with check (user_id = public.current_profile_id());
drop policy if exists emergency_contacts_update on public.emergency_contacts;
create policy emergency_contacts_update on public.emergency_contacts for update to authenticated
  using (user_id = public.current_profile_id())
  with check (user_id = public.current_profile_id());
drop policy if exists emergency_contacts_delete on public.emergency_contacts;
create policy emergency_contacts_delete on public.emergency_contacts for delete to authenticated
  using (user_id = public.current_profile_id());

drop policy if exists sos_alerts_select on public.sos_alerts;
create policy sos_alerts_select on public.sos_alerts for select to authenticated
  using (
    user_id = public.current_profile_id()
    or public.is_admin()
    or public.desk_role() = 'security'
  );
drop policy if exists sos_alerts_insert on public.sos_alerts;
create policy sos_alerts_insert on public.sos_alerts for insert to authenticated
  with check (user_id = public.current_profile_id());
drop policy if exists sos_alerts_update on public.sos_alerts;
create policy sos_alerts_update on public.sos_alerts for update to authenticated
  using (
    user_id = public.current_profile_id()
    or public.is_admin()
    or public.desk_role() = 'security'
  )
  with check (
    user_id = public.current_profile_id()
    or public.is_admin()
    or public.desk_role() = 'security'
  );

grant select, insert, update, delete on public.emergency_contacts to authenticated;
grant select, insert, update on public.sos_alerts to authenticated;

delete from public.notifications n
where n.title = 'SOS help request'
  and not exists (
    select 1 from public.profiles p
    where p.id = n.user_id and p.role = 'admin'
  );
