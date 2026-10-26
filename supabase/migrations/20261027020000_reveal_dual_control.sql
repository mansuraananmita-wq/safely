-- Two-person control for revealing anonymous reporters (admin or Student Affairs).

alter table public.report_identities
  add column if not exists revealed_at timestamptz;

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

alter table public.reveal_requests enable row level security;

drop policy if exists reveal_requests_select on public.reveal_requests;
create policy reveal_requests_select on public.reveal_requests for select to authenticated
  using (public.is_admin() or public.desk_department() = 'd-affairs');

grant select on public.reveal_requests to authenticated;

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

grant execute on function public.can_reveal_desk() to authenticated;
grant execute on function public.request_reveal(text, text) to authenticated;
grant execute on function public.decide_reveal_request(text, text) to authenticated;
grant execute on function public.reveal_reporter(text, text) to authenticated;
