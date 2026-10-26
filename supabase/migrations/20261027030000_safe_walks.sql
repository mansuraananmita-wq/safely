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
