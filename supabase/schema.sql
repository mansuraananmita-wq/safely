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

create table if not exists public.report_identities (
  report_id text primary key references public.reports (id) on delete cascade,
  user_id text not null references public.profiles (id) on delete cascade,
  revealed_at timestamptz
);

create index if not exists report_identities_user_idx on public.report_identities (user_id);

create table if not exists public.reveal_requests (
  id text primary key,
  report_id text not null references public.reports (id) on delete cascade,
  requested_by text not null references public.profiles (id),
  reason text not null,
  status text not null check (status in ('pending', 'approved', 'rejected')),
  approved_by text references public.profiles (id),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  opened_at timestamptz,
  constraint reveal_requests_approver_diff check (approved_by is null or approved_by <> requested_by)
);

create index if not exists reveal_requests_report_idx on public.reveal_requests (report_id, status);
create index if not exists reveal_requests_pending_idx on public.reveal_requests (status) where status = 'pending';
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

create or replace function public.owns_report(r public.reports)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_profile_id() is not null
    and (
      (r.reporter_id is not null and r.reporter_id = public.current_profile_id())
      or exists (
        select 1
        from public.report_identities ri
        where ri.report_id = r.id
          and ri.user_id = public.current_profile_id()
      )
    );
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
        (r.status = 'draft' and public.owns_report(r))
        or (public.owns_report(r) and r.status <> 'draft')
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
  if new.anonymous then
    new.confidential := true;
    new.reporter_id := null;
  end if;
  if new.confidential and new.department_id is not null and new.department_id not in ('d-sec', 'd-affairs') then
    raise exception 'Confidential reports stay with Security or Student Affairs';
  end if;
  if tg_op = 'INSERT' then
    if new.anonymous then
      null;
    elsif new.reporter_id is distinct from actor_id and actor_role <> 'admin' then
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
    if not public.owns_report(old) then
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

create or replace function public.link_report_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_profile_id();
begin
  if not new.anonymous then
    return new;
  end if;
  if actor_id is null then
    return new;
  end if;
  insert into public.report_identities (report_id, user_id)
  values (new.id, actor_id)
  on conflict (report_id) do nothing;
  return new;
end;
$$;

drop trigger if exists reports_link_identity on public.reports;
create trigger reports_link_identity
  after insert on public.reports
  for each row execute function public.link_report_identity();

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

-- Public /status aggregates. Counts under 5 are labeled, not returned as exact numbers.

create or replace function public.public_count_label(n bigint)
returns text
language sql
immutable
as $$
  select case
    when n is null or n <= 0 then '0'
    when n < 5 then 'fewer than 5'
    else n::text
  end;
$$;

create or replace function public.public_count_exact(n bigint)
returns bigint
language sql
immutable
as $$
  select case when n is null or n < 5 then null else n end;
$$;

create or replace view public.public_status_by_category
with (security_invoker = false) as
with eligible as (
  select
    r.category,
    r.status,
    r.created_at,
    r.resolved_at
  from public.reports r
  where r.confidential = false
    and r.anonymous = false
    and r.category not in ('harassment', 'safety')
    and r.status not in ('draft', 'rejected')
),
agg as (
  select
    c.id as category_id,
    c.en,
    c.bn,
    count(*) filter (
      where e.status in ('submitted', 'under_review', 'assigned', 'in_progress', 'reopened')
    )::bigint as open_raw,
    count(*) filter (
      where e.status in ('resolved', 'closed')
    )::bigint as resolved_raw,
    avg(
      extract(epoch from (e.resolved_at - e.created_at)) / 3600.0
    ) filter (
      where e.resolved_at is not null
        and e.resolved_at >= (now() - interval '30 days')
        and e.status in ('resolved', 'closed')
    ) as avg_hours_30d
  from public.categories c
  left join eligible e on e.category = c.id
  where c.id not in ('harassment', 'safety')
  group by c.id, c.en, c.bn
)
select
  category_id,
  en,
  bn,
  public.public_count_exact(open_raw) as open_count,
  public.public_count_label(open_raw) as open_label,
  public.public_count_exact(resolved_raw) as resolved_count,
  public.public_count_label(resolved_raw) as resolved_label,
  case
    when avg_hours_30d is null then null
    else round((avg_hours_30d / 24.0)::numeric, 1)
  end as avg_resolution_days_30d
from agg;

create or replace view public.public_status_by_office
with (security_invoker = false) as
with eligible as (
  select
    r.department_id,
    r.status,
    r.created_at,
    r.resolved_at
  from public.reports r
  where r.confidential = false
    and r.anonymous = false
    and r.category not in ('harassment', 'safety')
    and r.status not in ('draft', 'rejected')
    and r.department_id is not null
),
agg as (
  select
    d.id as office_id,
    d.en,
    d.bn,
    count(*) filter (
      where e.status in ('submitted', 'under_review', 'assigned', 'in_progress', 'reopened')
    )::bigint as open_raw,
    count(*) filter (
      where e.status in ('resolved', 'closed')
    )::bigint as resolved_raw,
    avg(
      extract(epoch from (e.resolved_at - e.created_at)) / 3600.0
    ) filter (
      where e.resolved_at is not null
        and e.resolved_at >= (now() - interval '30 days')
        and e.status in ('resolved', 'closed')
    ) as avg_hours_30d
  from public.departments d
  left join eligible e on e.department_id = d.id
  where d.sensitive = false
  group by d.id, d.en, d.bn
)
select
  office_id,
  en,
  bn,
  public.public_count_exact(open_raw) as open_count,
  public.public_count_label(open_raw) as open_label,
  public.public_count_exact(resolved_raw) as resolved_count,
  public.public_count_label(resolved_raw) as resolved_label,
  case
    when avg_hours_30d is null then null
    else round((avg_hours_30d / 24.0)::numeric, 1)
  end as avg_resolution_days_30d
from agg;

create or replace view public.public_status_summary
with (security_invoker = false) as
with eligible as (
  select
    r.status,
    r.created_at,
    r.resolved_at
  from public.reports r
  where r.confidential = false
    and r.anonymous = false
    and r.category not in ('harassment', 'safety')
    and r.status not in ('draft', 'rejected')
),
agg as (
  select
    count(*) filter (
      where status in ('submitted', 'under_review', 'assigned', 'in_progress', 'reopened')
    )::bigint as open_raw,
    count(*) filter (
      where status in ('resolved', 'closed')
    )::bigint as resolved_raw,
    count(*) filter (
      where status in ('resolved', 'closed')
        and resolved_at is not null
        and resolved_at >= (now() - interval '30 days')
    )::bigint as resolved_30d_raw,
    avg(
      extract(epoch from (resolved_at - created_at)) / 3600.0
    ) filter (
      where resolved_at is not null
        and resolved_at >= (now() - interval '30 days')
        and status in ('resolved', 'closed')
    ) as avg_hours_30d
  from eligible
)
select
  public.public_count_exact(open_raw) as open_count,
  public.public_count_label(open_raw) as open_label,
  public.public_count_exact(resolved_raw) as resolved_count,
  public.public_count_label(resolved_raw) as resolved_label,
  public.public_count_exact(resolved_30d_raw) as resolved_30d_count,
  public.public_count_label(resolved_30d_raw) as resolved_30d_label,
  case
    when avg_hours_30d is null then null
    else round((avg_hours_30d / 24.0)::numeric, 1)
  end as avg_resolution_days_30d
from agg;

-- Row level security ------------------------------------------------------

alter table public.places enable row level security;
alter table public.departments enable row level security;
alter table public.categories enable row level security;
alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.report_identities enable row level security;
alter table public.reveal_requests enable row level security;
alter table public.report_activities enable row level security;
alter table public.report_confirmations enable row level security;
alter table public.notifications enable row level security;
alter table public.announcements enable row level security;
alter table public.support_contacts enable row level security;
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
  using (status = 'draft' and public.owns_report(reports));

drop policy if exists report_identities_select on public.report_identities;
create policy report_identities_select on public.report_identities for select to authenticated
  using (user_id = public.current_profile_id());

drop policy if exists reveal_requests_select on public.reveal_requests;
create policy reveal_requests_select on public.reveal_requests for select to authenticated
  using (public.is_admin() or public.desk_department() = 'd-affairs');

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
grant execute on function public.public_count_label(bigint) to anon, authenticated;
grant execute on function public.public_count_exact(bigint) to anon, authenticated;
grant select on public.public_status_by_category, public.public_status_by_office, public.public_status_summary to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.reports to authenticated;
grant select on public.report_identities to authenticated;
grant select on public.reveal_requests to authenticated;
grant select, insert, delete on public.report_activities to authenticated;
grant select, insert on public.report_confirmations to authenticated;
grant select, insert, update on public.notifications to authenticated;
grant insert, update on public.announcements to authenticated;
grant select, insert, update, delete on public.support_contacts to authenticated;
grant select, insert, update on public.lost_found to authenticated;
grant select, insert on public.audit_log to authenticated;
grant update on public.departments, public.categories to authenticated;

create or replace function public.notify_report_owner(
  p_report_id text,
  p_title text,
  p_body text,
  p_href text,
  p_kind text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id text;
  note_id text;
begin
  if not exists (select 1 from public.reports r where r.id = p_report_id and public.can_read_report(r)) then
    raise exception 'Not allowed';
  end if;
  select ri.user_id into owner_id
  from public.report_identities ri
  where ri.report_id = p_report_id;
  if owner_id is null then
    select r.reporter_id into owner_id
    from public.reports r
    where r.id = p_report_id;
  end if;
  if owner_id is null then
    return;
  end if;
  note_id := 'n' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  insert into public.notifications (id, user_id, title, body, href, read, created_at, kind)
  values (note_id, owner_id, p_title, p_body, p_href, false, now(), p_kind);
end;
$$;

create or replace function public.can_reveal_desk()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.desk_department() = 'd-affairs';
$$;

create or replace function public.request_reveal(p_report_id text, p_reason text)
returns public.reveal_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_profile_id();
  actor_name text;
  report_row public.reports;
  reason text := trim(p_reason);
  request_row public.reveal_requests;
begin
  if actor_id is null then
    raise exception 'Not signed in';
  end if;
  if not public.can_reveal_desk() then
    raise exception 'Only operations or Student Affairs can request a reveal';
  end if;
  if char_length(reason) < 8 then
    raise exception 'Write a short reason for the audit log';
  end if;
  select * into report_row from public.reports where id = p_report_id;
  if report_row.id is null then
    raise exception 'Report not found';
  end if;
  if not report_row.anonymous then
    raise exception 'This report is not anonymous';
  end if;
  if report_row.category not in ('harassment', 'safety') then
    raise exception 'Reveal is only for harassment or safety emergencies';
  end if;
  if not public.can_read_report(report_row) then
    raise exception 'Not allowed';
  end if;
  if exists (
    select 1 from public.reveal_requests rr
    where rr.report_id = p_report_id and rr.status = 'pending'
  ) then
    raise exception 'A reveal request is already pending for this report';
  end if;
  if exists (
    select 1 from public.reveal_requests rr
    where rr.report_id = p_report_id and rr.status = 'approved'
  ) then
    raise exception 'This report already has an approved reveal request';
  end if;

  select p.name into actor_name from public.profiles p where p.id = actor_id;
  insert into public.reveal_requests (id, report_id, requested_by, reason, status, created_at)
  values (
    'rr' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
    p_report_id,
    actor_id,
    reason,
    'pending',
    now()
  )
  returning * into request_row;

  insert into public.audit_log (id, at, actor, action, target)
  values (
    'au' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
    now(),
    coalesce(actor_name, actor_id),
    'Requested anonymous reveal (' || reason || ')',
    p_report_id
  );

  return request_row;
end;
$$;

create or replace function public.decide_reveal_request(p_request_id text, p_decision text)
returns public.reveal_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_profile_id();
  actor_name text;
  decision text := lower(trim(p_decision));
  request_row public.reveal_requests;
  report_row public.reports;
begin
  if actor_id is null then
    raise exception 'Not signed in';
  end if;
  if not public.can_reveal_desk() then
    raise exception 'Only operations or Student Affairs can decide a reveal request';
  end if;
  if decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  select * into request_row from public.reveal_requests where id = p_request_id for update;
  if request_row.id is null then
    raise exception 'Reveal request not found';
  end if;
  if request_row.status <> 'pending' then
    raise exception 'This reveal request is already decided';
  end if;
  if request_row.requested_by = actor_id then
    raise exception 'You cannot approve or reject your own reveal request';
  end if;

  select * into report_row from public.reports where id = request_row.report_id;
  if report_row.id is null or not public.can_read_report(report_row) then
    raise exception 'Not allowed';
  end if;

  select p.name into actor_name from public.profiles p where p.id = actor_id;
  update public.reveal_requests
  set status = decision,
      approved_by = actor_id,
      decided_at = now()
  where id = p_request_id
  returning * into request_row;

  insert into public.audit_log (id, at, actor, action, target)
  values (
    'au' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
    now(),
    coalesce(actor_name, actor_id),
    case
      when decision = 'approved' then 'Approved anonymous reveal (' || request_row.reason || ')'
      else 'Rejected anonymous reveal (' || request_row.reason || ')'
    end,
    request_row.report_id
  );

  return request_row;
end;
$$;

create or replace function public.reveal_reporter(p_report_id text, p_reason text)
returns table (user_id text, name text, email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_profile_id();
  actor_name text;
  report_row public.reports;
  owner_id text;
  reason text := trim(p_reason);
  approved public.reveal_requests;
  note_id text;
begin
  if actor_id is null then
    raise exception 'Not signed in';
  end if;
  if not public.can_reveal_desk() then
    raise exception 'Only operations or Student Affairs can reveal a reporter';
  end if;
  if char_length(reason) < 8 then
    raise exception 'Write a short reason for the audit log';
  end if;
  select * into report_row from public.reports where id = p_report_id;
  if report_row.id is null then
    raise exception 'Report not found';
  end if;
  if not report_row.anonymous then
    raise exception 'This report is not anonymous';
  end if;
  if report_row.category not in ('harassment', 'safety') then
    raise exception 'Reveal is only for harassment or safety emergencies';
  end if;
  if not public.can_read_report(report_row) then
    raise exception 'Not allowed';
  end if;

  select * into approved
  from public.reveal_requests rr
  where rr.report_id = p_report_id
    and rr.status = 'approved'
  order by rr.decided_at desc nulls last
  limit 1;
  if approved.id is null then
    raise exception 'Reveal needs an approved request from a second desk officer';
  end if;

  select ri.user_id into owner_id from public.report_identities ri where ri.report_id = p_report_id;
  if owner_id is null then
    raise exception 'No identity is stored for this report';
  end if;

  select p.name into actor_name from public.profiles p where p.id = actor_id;
  update public.report_identities
  set revealed_at = coalesce(revealed_at, now())
  where report_id = p_report_id;

  update public.reveal_requests
  set opened_at = coalesce(opened_at, now())
  where id = approved.id;

  insert into public.audit_log (id, at, actor, action, target)
  values (
    'au' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
    now(),
    coalesce(actor_name, actor_id),
    'Revealed anonymous reporter (' || reason || ')',
    p_report_id
  );

  note_id := 'n' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  insert into public.notifications (id, user_id, title, body, href, read, created_at, kind)
  values (
    note_id,
    owner_id,
    'Your anonymous identity was revealed',
    'Campus operations revealed your identity on ' || p_report_id || ' after a two-person approval.',
    '/app/reports/' || p_report_id,
    false,
    now(),
    'info'
  );

  return query
  select p.id, p.name, p.email
  from public.profiles p
  where p.id = owner_id;
end;
$$;

grant execute on function public.notify_report_owner(text, text, text, text, text) to authenticated;
grant execute on function public.can_reveal_desk() to authenticated;
grant execute on function public.request_reveal(text, text) to authenticated;
grant execute on function public.decide_reveal_request(text, text) to authenticated;
grant execute on function public.reveal_reporter(text, text) to authenticated;

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
  seen_at timestamptz,
  resolved_at timestamptz
);

alter table public.sos_alerts add column if not exists resolved_at timestamptz;
alter table public.sos_alerts add column if not exists seen_at timestamptz;

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

create or replace function public.notify_sos_desk()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (id, user_id, title, body, href, read, created_at)
  select
    'n' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
    p.id,
    'SOS help request',
    new.message,
    '/admin/sos',
    false,
    coalesce(new.created_at, now())
  from public.profiles p
  where p.role in ('admin', 'security')
    and coalesce(p.suspended, false) = false
    and p.id is distinct from new.user_id;
  return new;
end;
$$;

drop trigger if exists sos_alerts_notify_desk on public.sos_alerts;
create trigger sos_alerts_notify_desk
  after insert on public.sos_alerts
  for each row execute function public.notify_sos_desk();

create or replace function public.sos_live_accuracy_ok(old_accuracy double precision, new_accuracy double precision)
returns boolean
language sql
immutable
as $$
  select new_accuracy is not null
    and new_accuracy > 0
    and new_accuracy <= 1000
    and (
      old_accuracy is null
      or new_accuracy <= greatest(old_accuracy + 80, old_accuracy * 2)
    );
$$;

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

  if new.seen_at is distinct from old.seen_at then
    if auth.uid() is not null and not (public.is_admin() or public.desk_role() = 'security') then
      raise exception 'Only the desk can mark an SOS as seen';
    end if;
    if old.seen_at is not null then
      raise exception 'SOS seen time cannot change';
    end if;
  end if;

  if new.resolved_at is distinct from old.resolved_at then
    if auth.uid() is not null and not (public.is_admin() or public.desk_role() = 'security') then
      raise exception 'Only the desk can close an SOS';
    end if;
    if new.resolved_at is not null and new.seen_at is null then
      new.seen_at := coalesce(old.seen_at, new.resolved_at);
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
    if new.lat is null or new.lng is null or not public.sos_live_accuracy_ok(old.accuracy_m, new.accuracy_m) then
      raise exception 'A later fix must stay close enough to find you';
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
    where p.id = n.user_id and p.role in ('admin', 'security')
  );

-- Safe Walk

-- Safe Walk check-ins. Location is optional and wiped 24 hours after the walk closes.

create table if not exists public.safe_walks (
  id text primary key,
  user_id text not null references public.profiles (id) on delete cascade,
  sender_name text not null default '',
  destination_id text not null references public.places (id),
  destination text not null,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  closed_at timestamptz,
  status text not null default 'active' check (status in ('active', 'arrived', 'expired', 'cancelled')),
  share_location boolean not null default false,
  notify_desk boolean not null default true,
  contact_name text not null default '',
  contact_phone text not null default '',
  last_lat double precision,
  last_lng double precision,
  last_accuracy_m double precision,
  location_updated_at timestamptz,
  constraint safe_walks_timer check (ends_at > started_at),
  constraint safe_walks_timer_window check (
    ends_at <= started_at + interval '60 minutes'
    and ends_at >= started_at + interval '5 minutes'
  ),
  constraint safe_walks_location_only_when_shared check (
    share_location = true
    or (last_lat is null and last_lng is null and last_accuracy_m is null)
  )
);

create index if not exists safe_walks_user_started on public.safe_walks (user_id, started_at desc);
create index if not exists safe_walks_status_ends on public.safe_walks (status, ends_at);
create index if not exists safe_walks_closed on public.safe_walks (closed_at)
  where closed_at is not null;

create or replace function public.guard_safe_walk()
returns trigger
language plpgsql
as $$
declare
  clearing_location boolean;
  overdue_expire boolean;
  stale_cleanup boolean;
begin
  if tg_op = 'INSERT' then
    if new.user_id is distinct from public.current_profile_id() then
      raise exception 'Safe Walk owner mismatch';
    end if;
    if new.status <> 'active' then
      raise exception 'A new Safe Walk must start active';
    end if;
    if new.closed_at is not null then
      raise exception 'A new Safe Walk cannot be closed already';
    end if;
    if not new.share_location then
      new.last_lat := null;
      new.last_lng := null;
      new.last_accuracy_m := null;
      new.location_updated_at := null;
    end if;
    return new;
  end if;

  if new.user_id is distinct from old.user_id
    or new.started_at is distinct from old.started_at
    or new.ends_at is distinct from old.ends_at
    or new.destination_id is distinct from old.destination_id
    or new.destination is distinct from old.destination
    or new.notify_desk is distinct from old.notify_desk
    or new.contact_name is distinct from old.contact_name
    or new.contact_phone is distinct from old.contact_phone
    or new.share_location is distinct from old.share_location
    or new.sender_name is distinct from old.sender_name
    or new.id is distinct from old.id then
    raise exception 'A Safe Walk cannot be rewritten';
  end if;

  overdue_expire := old.status = 'active' and new.status = 'expired' and old.ends_at <= now();
  clearing_location :=
    new.last_lat is null and new.last_lng is null and new.last_accuracy_m is null
    and (old.last_lat is not null or old.last_lng is not null or old.last_accuracy_m is not null);
  stale_cleanup :=
    clearing_location
    and old.status in ('arrived', 'expired', 'cancelled')
    and old.closed_at is not null
    and old.closed_at < now() - interval '24 hours';

  if old.status <> 'active' and new.status is distinct from old.status then
    raise exception 'A closed Safe Walk cannot change status';
  end if;

  if new.status is distinct from old.status then
    if overdue_expire then
      new.closed_at := coalesce(new.closed_at, now());
    elsif public.current_profile_id() is distinct from old.user_id then
      raise exception 'Only the walker can close a Safe Walk';
    elsif new.status in ('arrived', 'cancelled', 'expired') then
      new.closed_at := coalesce(new.closed_at, now());
    else
      raise exception 'Bad Safe Walk status';
    end if;
  end if;

  if new.last_lat is distinct from old.last_lat
    or new.last_lng is distinct from old.last_lng
    or new.last_accuracy_m is distinct from old.last_accuracy_m
    or new.location_updated_at is distinct from old.location_updated_at then
    if stale_cleanup then
      new.location_updated_at := null;
    elsif public.current_profile_id() is distinct from old.user_id then
      raise exception 'Only the walker can update Safe Walk location';
    elsif clearing_location and old.status <> 'active' then
      new.location_updated_at := null;
    elsif old.status <> 'active' then
      raise exception 'Location updates stop when the walk closes';
    elsif not old.share_location then
      raise exception 'Location sharing was off for this walk';
    else
      new.location_updated_at := coalesce(new.location_updated_at, now());
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists safe_walks_guard on public.safe_walks;
create trigger safe_walks_guard
  before insert or update on public.safe_walks
  for each row execute function public.guard_safe_walk();

create or replace function public.expire_due_safe_walks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer := 0;
  walk public.safe_walks;
begin
  for walk in
    select *
    from public.safe_walks
    where status = 'active'
      and ends_at <= now()
    for update
  loop
    update public.safe_walks
    set status = 'expired',
        closed_at = coalesce(closed_at, now())
    where id = walk.id;

    insert into public.notifications (id, user_id, title, body, href, read, created_at)
    select
      'n' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
      p.id,
      'Safe Walk timer ended',
      case
        when walk.share_location and walk.last_lat is not null and walk.last_lng is not null then
          walk.sender_name || ' did not tap I arrived for ' || walk.destination
          || '. Last shared pin: ' || round(walk.last_lat::numeric, 5) || ', ' || round(walk.last_lng::numeric, 5) || '.'
        else
          walk.sender_name || ' did not tap I arrived for ' || walk.destination || '.'
      end,
      '/admin/safe-walk',
      false,
      now()
    from public.profiles p
    where walk.notify_desk
      and p.role in ('admin', 'security')
      and coalesce(p.suspended, false) = false
      and p.id is distinct from walk.user_id;

    changed := changed + 1;
  end loop;
  return changed;
end;
$$;

create or replace function public.cleanup_safe_walk_locations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer := 0;
begin
  update public.safe_walks
  set last_lat = null,
      last_lng = null,
      last_accuracy_m = null,
      location_updated_at = null
  where status in ('arrived', 'expired', 'cancelled')
    and closed_at is not null
    and closed_at < now() - interval '24 hours'
    and (last_lat is not null or last_lng is not null or last_accuracy_m is not null);
  get diagnostics changed = row_count;
  return changed;
end;
$$;

alter table public.safe_walks enable row level security;

drop policy if exists safe_walks_select on public.safe_walks;
create policy safe_walks_select on public.safe_walks for select to authenticated
  using (
    user_id = public.current_profile_id()
    or (
      status = 'expired'
      and (public.is_admin() or public.desk_role() = 'security')
    )
  );

drop policy if exists safe_walks_insert on public.safe_walks;
create policy safe_walks_insert on public.safe_walks for insert to authenticated
  with check (user_id = public.current_profile_id());

drop policy if exists safe_walks_update on public.safe_walks;
create policy safe_walks_update on public.safe_walks for update to authenticated
  using (user_id = public.current_profile_id())
  with check (user_id = public.current_profile_id());

grant select, insert, update on public.safe_walks to authenticated;
grant execute on function public.expire_due_safe_walks() to authenticated;
grant execute on function public.cleanup_safe_walk_locations() to authenticated;

-- Key/value campus settings. Signed-in users read; only admin writes.
create table if not exists public.app_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings for select to authenticated
  using (true);

drop policy if exists app_settings_insert on public.app_settings;
create policy app_settings_insert on public.app_settings for insert to authenticated
  with check (public.is_admin());

drop policy if exists app_settings_update on public.app_settings;
create policy app_settings_update on public.app_settings for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists app_settings_delete on public.app_settings;
create policy app_settings_delete on public.app_settings for delete to authenticated
  using (public.is_admin());

grant select, insert, update, delete on public.app_settings to authenticated;

insert into public.app_settings (key, value)
values ('security_sms_number', '01XXXXXXXXX')
on conflict (key) do nothing;

-- Abuse flags and daily report caps. See migrations/20261027050000_report_abuse.sql.
create table if not exists public.report_flags (
  id text primary key,
  report_id text not null unique references public.reports (id) on delete cascade,
  kind text not null check (kind in ('invalid', 'malicious')),
  reason text not null,
  flagged_by text not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists report_flags_report_idx on public.report_flags (report_id);

create table if not exists public.account_report_flags (
  id text primary key,
  user_id text not null references public.profiles (id) on delete cascade,
  report_id text not null unique references public.reports (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists account_report_flags_user_idx on public.account_report_flags (user_id, created_at desc);

create table if not exists public.account_report_caps (
  user_id text primary key references public.profiles (id) on delete cascade,
  tight_until timestamptz
);

alter table public.report_flags enable row level security;
alter table public.account_report_flags enable row level security;
alter table public.account_report_caps enable row level security;

drop policy if exists report_flags_select on public.report_flags;
create policy report_flags_select on public.report_flags for select to authenticated
  using (
    exists (
      select 1 from public.reports r
      where r.id = report_id and public.can_read_report(r)
    )
  );

revoke all on public.account_report_flags from public, anon, authenticated;
revoke all on public.account_report_caps from public, anon, authenticated;
grant select on public.report_flags to authenticated;

create or replace function public.account_recent_flag_count(p_user_id text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.account_report_flags
  where user_id = p_user_id
    and created_at > now() - interval '30 days';
$$;

revoke all on function public.account_recent_flag_count(text) from public, anon, authenticated;

create or replace function public.enforce_daily_report_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text;
  cap integer := 10;
  tight timestamptz;
  used integer;
begin
  if auth.uid() is null then
    return new;
  end if;
  actor := public.current_profile_id();
  if actor is null then
    raise exception 'Not signed in';
  end if;
  select tight_until into tight
  from public.account_report_caps
  where user_id = actor;
  if tight is not null and tight > now() then
    cap := 3;
  end if;
  select count(*)::int into used
  from (
    select r.id
    from public.reports r
    where r.reporter_id = actor
      and r.created_at >= date_trunc('day', now())
    union
    select r.id
    from public.reports r
    join public.report_identities i on i.report_id = r.id
    where i.user_id = actor
      and r.created_at >= date_trunc('day', now())
  ) owned;
  if used >= cap then
    raise exception 'Daily report cap reached (% per day)', cap;
  end if;
  return new;
end;
$$;

drop trigger if exists reports_daily_cap on public.reports;
create trigger reports_daily_cap
  before insert on public.reports
  for each row execute function public.enforce_daily_report_cap();

create or replace function public.flag_report(p_report_id text, p_kind text, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text := public.current_profile_id();
  actor_name text;
  rep public.reports;
  owner_id text;
  is_anon boolean;
begin
  if not public.is_admin() then
    raise exception 'Only admin can flag a report';
  end if;
  if p_kind not in ('invalid', 'malicious') then
    raise exception 'Flag kind must be invalid or malicious';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'A reason is required';
  end if;
  select * into rep from public.reports where id = p_report_id;
  if not found then
    raise exception 'Report not found';
  end if;
  if exists (select 1 from public.report_flags where report_id = p_report_id) then
    raise exception 'This report is already flagged';
  end if;
  select name into actor_name from public.profiles where id = actor;

  insert into public.report_flags (id, report_id, kind, reason, flagged_by)
  values (
    'rf' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
    p_report_id,
    p_kind,
    trim(p_reason),
    actor
  );

  is_anon := rep.anonymous;
  if is_anon then
    select user_id into owner_id from public.report_identities where report_id = p_report_id;
  else
    owner_id := rep.reporter_id;
  end if;

  if owner_id is not null then
    insert into public.account_report_flags (id, user_id, report_id)
    values (
      'af' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
      owner_id,
      p_report_id
    );
    if public.account_recent_flag_count(owner_id) >= 3 then
      insert into public.account_report_caps (user_id, tight_until)
      values (owner_id, now() + interval '14 days')
      on conflict (user_id) do update
        set tight_until = greatest(coalesce(public.account_report_caps.tight_until, now()), excluded.tight_until);
    end if;
  end if;

  insert into public.audit_log (id, at, actor, action, target)
  values (
    'au' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
    now(),
    coalesce(actor_name, 'Admin'),
    case
      when is_anon then 'Flagged anonymous report as ' || p_kind || ': ' || trim(p_reason)
      else 'Flagged report as ' || p_kind || ': ' || trim(p_reason)
    end,
    p_report_id
  );

  insert into public.report_activities (id, report_id, at, actor, visibility, kind, message)
  values (
    'ac' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
    p_report_id,
    now(),
    'Campus desk',
    'internal',
    'internal',
    'Flagged as ' || p_kind || '. ' || trim(p_reason)
  );
end;
$$;

grant execute on function public.flag_report(text, text, text) to authenticated;

-- Phone push tokens. A user can write only their own rows.
create table if not exists public.device_tokens (
  user_id text not null references public.profiles (id) on delete cascade,
  token text primary key,
  platform text not null check (platform in ('android', 'ios', 'web', 'other')),
  updated_at timestamptz not null default now()
);

create index if not exists device_tokens_user_idx on public.device_tokens (user_id, updated_at desc);

alter table public.device_tokens enable row level security;

drop policy if exists device_tokens_select on public.device_tokens;
create policy device_tokens_select on public.device_tokens for select to authenticated
  using (user_id = public.current_profile_id());

drop policy if exists device_tokens_insert on public.device_tokens;
create policy device_tokens_insert on public.device_tokens for insert to authenticated
  with check (user_id = public.current_profile_id());

drop policy if exists device_tokens_update on public.device_tokens;
create policy device_tokens_update on public.device_tokens for update to authenticated
  using (user_id = public.current_profile_id())
  with check (user_id = public.current_profile_id());

drop policy if exists device_tokens_delete on public.device_tokens;
create policy device_tokens_delete on public.device_tokens for delete to authenticated
  using (user_id = public.current_profile_id());

grant select, insert, update, delete on public.device_tokens to authenticated;


-- Voice notes and short videos. Files live in a private bucket.
-- The reporter, the assigned office, and security can read them. The path is the report id, never the account id.

alter table public.reports add column if not exists voice_note jsonb;
alter table public.reports add column if not exists video jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report-media',
  'report-media',
  false,
  20971520,
  array[
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
    'audio/aac',
    'audio/x-m4a',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_read_report_media(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reports r
    where r.id = split_part(object_name, '/', 1)
      and (
        public.owns_report(r)
        or public.desk_role() = 'security'
        or (
          r.department_id is not null
          and public.desk_role() = 'department'
          and public.desk_department() = r.department_id
        )
      )
  );
$$;

create or replace function public.can_upload_report_media(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reports r
    where r.id = split_part(object_name, '/', 1)
      and public.owns_report(r)
  );
$$;

create or replace function public.report_media_file_ok(object_name text, meta jsonb)
returns boolean
language sql
stable
set search_path = public, storage
as $$
  select
    case
      when storage.filename(object_name) ~ '^voice\.(webm|m4a|mp3|aac)$'
        and coalesce(meta->>'mimetype', '') in ('audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a')
        and coalesce((meta->>'size')::bigint, 0) between 1 and 10485760
        then true
      when storage.filename(object_name) ~ '^video\.(mp4|webm|mov)$'
        and coalesce(meta->>'mimetype', '') in ('video/mp4', 'video/webm', 'video/quicktime')
        and coalesce((meta->>'size')::bigint, 0) between 1 and 20971520
        then true
      else false
    end;
$$;

revoke all on function public.can_read_report_media(text) from public, anon;
revoke all on function public.can_upload_report_media(text) from public, anon;
grant execute on function public.can_read_report_media(text) to authenticated;
grant execute on function public.can_upload_report_media(text) to authenticated;
grant execute on function public.report_media_file_ok(text, jsonb) to authenticated;

drop policy if exists report_media_select on storage.objects;
create policy report_media_select on storage.objects for select to authenticated
  using (
    bucket_id = 'report-media'
    and public.can_read_report_media(name)
  );

drop policy if exists report_media_insert on storage.objects;
create policy report_media_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'report-media'
    and public.can_upload_report_media(name)
    and public.report_media_file_ok(name, metadata)
  );

drop policy if exists report_media_update on storage.objects;
create policy report_media_update on storage.objects for update to authenticated
  using (bucket_id = 'report-media' and public.can_upload_report_media(name))
  with check (
    bucket_id = 'report-media'
    and public.can_upload_report_media(name)
    and public.report_media_file_ok(name, metadata)
  );

drop policy if exists report_media_delete on storage.objects;
create policy report_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'report-media' and public.can_upload_report_media(name));

