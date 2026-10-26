-- SOS live share: later pins may move while GPS stays close. City/IP pins stay blocked.

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
