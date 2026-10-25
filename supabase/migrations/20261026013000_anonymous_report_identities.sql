-- Anonymous reports: keep the reporter link off reports.reporter_id.
-- Identity lives in report_identities (owner-only SELECT). Staff cannot read it.
-- reveal_reporter() is the only audited path for admin / Student Affairs on harassment or safety.

create table if not exists public.report_identities (
  report_id text primary key references public.reports (id) on delete cascade,
  user_id text not null references public.profiles (id) on delete cascade
);

create index if not exists report_identities_user_idx on public.report_identities (user_id);

alter table public.report_identities enable row level security;

drop policy if exists report_identities_select on public.report_identities;
create policy report_identities_select on public.report_identities for select to authenticated
  using (user_id = public.current_profile_id());

-- No insert/update/delete policies for authenticated: only triggers / security definer write.

grant select on public.report_identities to authenticated;

-- Move any existing anonymous reporter_id values into the private table.
insert into public.report_identities (report_id, user_id)
select r.id, r.reporter_id
from public.reports r
where r.anonymous = true
  and r.reporter_id is not null
on conflict (report_id) do nothing;

update public.reports
set reporter_id = null
where anonymous = true
  and reporter_id is not null;

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

drop policy if exists reports_delete on public.reports;
create policy reports_delete on public.reports for delete to authenticated
  using (status = 'draft' and public.owns_report(reports));

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

create or replace function public.reveal_reporter(p_report_id text, p_reason text)
returns table (user_id text, name text, email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id text := public.current_profile_id();
  actor_name text;
  actor_role text := public.desk_role();
  actor_dept text := public.desk_department();
  report_row public.reports;
  owner_id text;
  reason text := trim(p_reason);
begin
  if actor_id is null then
    raise exception 'Not signed in';
  end if;
  if not (public.is_admin() or actor_dept = 'd-affairs') then
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
  select ri.user_id into owner_id from public.report_identities ri where ri.report_id = p_report_id;
  if owner_id is null then
    raise exception 'No identity is stored for this report';
  end if;
  select p.name into actor_name from public.profiles p where p.id = actor_id;
  insert into public.audit_log (id, at, actor, action, target)
  values (
    'au' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
    now(),
    coalesce(actor_name, actor_id),
    'Revealed anonymous reporter (' || reason || ')',
    p_report_id
  );
  return query
  select p.id, p.name, p.email
  from public.profiles p
  where p.id = owner_id;
end;
$$;

grant execute on function public.notify_report_owner(text, text, text, text, text) to authenticated;
grant execute on function public.reveal_reporter(text, text) to authenticated;

-- Demo anonymous case: reply channel for Amina, still null on reports.reporter_id.
insert into public.report_identities (report_id, user_id)
select 'SF-10508', 'u-amina'
where exists (select 1 from public.reports where id = 'SF-10508')
  and exists (select 1 from public.profiles where id = 'u-amina')
on conflict (report_id) do nothing;

update public.report_activities
set message = 'Anonymous confidential report submitted. The desk can ask for more detail without seeing the name.'
where id = 'a508-1';
