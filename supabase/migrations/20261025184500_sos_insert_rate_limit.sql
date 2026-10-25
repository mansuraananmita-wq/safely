-- Rate-limit SOS inserts at the database. Leaves guard_sos_alert (UPDATE / 3-minute refine) alone.

create index if not exists sos_alerts_user_created on public.sos_alerts (user_id, created_at desc);

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
    -- SQL editor / service role paths still enforce by profile id on the row.
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
