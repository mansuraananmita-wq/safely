-- Abuse flags and daily report caps.
-- Content flags are visible with the report. Per-account counts stay in a restricted table
-- and are read only by security-definer functions inside the database.

create table if not exists public.report_flags (
  id text primary key,
  report_id text not null unique references public.reports (id) on delete cascade,
  kind text not null check (kind in ('invalid', 'malicious')),
  reason text not null,
  flagged_by text not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists report_flags_report_idx on public.report_flags (report_id);

-- Restricted. No reporter identity is copied onto report_flags.
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
