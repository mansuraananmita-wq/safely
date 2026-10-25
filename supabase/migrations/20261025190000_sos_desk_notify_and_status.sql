-- SOS desk notifications (admin + security) from a DB trigger.
-- Sender-facing status: sent → seen_at → resolved_at.
-- RLS: members/department only their own rows; admin/security read all and can solve.

alter table public.sos_alerts add column if not exists seen_at timestamptz;

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

-- Keep only admin/security SOS bell notices. Do not delete security users' notices.
delete from public.notifications n
where n.title = 'SOS help request'
  and not exists (
    select 1 from public.profiles p
    where p.id = n.user_id and p.role in ('admin', 'security')
  );
