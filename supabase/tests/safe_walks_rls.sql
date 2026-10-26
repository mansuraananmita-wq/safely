-- Safe Walk RLS: owner sees own; desk sees expired only; location wiped after 24h.

do $$
declare
  amina_auth uuid := 'a1111111-1111-4111-8111-111111111101';
  karim_auth uuid := 'a1111111-1111-4111-8111-111111111102';
  admin_auth uuid := 'a1111111-1111-4111-8111-111111111104';
  sec_auth uuid := 'a1111111-1111-4111-8111-111111111110';
  active_id text := 'sw-rls-active';
  expired_id text := 'sw-rls-expired';
  stale_id text := 'sw-rls-stale';
  seen int;
  cleaned int;
  expired_n int;
begin
  if not exists (select 1 from public.profiles where id = 'u-amina' and auth_user_id = amina_auth) then
    raise exception 'seed profile u-amina with known auth id is required';
  end if;

  delete from public.notifications where href = '/admin/safe-walk' and body like '%Safe Walk RLS%';
  delete from public.safe_walks where id in (active_id, expired_id, stale_id);

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', amina_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.safe_walks (
    id, user_id, sender_name, destination_id, destination, started_at, ends_at,
    status, share_location, notify_desk, last_lat, last_lng, last_accuracy_m, location_updated_at
  ) values
  (
    active_id, 'u-amina', 'Amina Rahman', 'library', 'Library Safe Walk RLS',
    now() - interval '2 minutes', now() + interval '20 minutes',
    'active', true, true, 23.74, 90.39, 12, now()
  ),
  (
    expired_id, 'u-amina', 'Amina Rahman', 'dorm', 'Dorm Safe Walk RLS',
    now() - interval '40 minutes', now() - interval '10 minutes',
    'active', true, true, 23.72, 90.38, 18, now() - interval '10 minutes'
  ),
  (
    stale_id, 'u-amina', 'Amina Rahman', 'gate', 'Gate Safe Walk RLS',
    now() - interval '20 minutes', now() + interval '10 minutes',
    'active', true, false, 23.73, 90.37, 9, now()
  );

  update public.safe_walks set status = 'arrived' where id = stale_id;
  execute 'reset role';

  -- Backdate closed_at for the 24h cleanup fixture (table owner bypasses RLS; do not touch location columns — the guard blocks that after close).
  update public.safe_walks
  set closed_at = now() - interval '30 hours'
  where id = stale_id;

  expired_n := public.expire_due_safe_walks();
  if not exists (select 1 from public.safe_walks where id = expired_id and status = 'expired') then
    raise exception 'expire_due_safe_walks did not expire overdue walk (changed=%)', expired_n;
  end if;

  -- Student cannot read another user's walk.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', karim_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select count(*)::int into seen from public.safe_walks where id in (active_id, expired_id);
  execute 'reset role';
  if seen <> 0 then
    raise exception 'student read another user Safe Walk (count=%)', seen;
  end if;

  -- Owner can read own active walk.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', amina_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select count(*)::int into seen from public.safe_walks where id = active_id;
  execute 'reset role';
  if seen <> 1 then
    raise exception 'owner could not read own active Safe Walk';
  end if;

  -- Admin cannot read active walks.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', admin_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select count(*)::int into seen from public.safe_walks where id = active_id;
  if seen <> 0 then
    raise exception 'admin read active Safe Walk (count=%)', seen;
  end if;
  select count(*)::int into seen from public.safe_walks where id = expired_id;
  execute 'reset role';
  if seen <> 1 then
    raise exception 'admin could not read expired Safe Walk';
  end if;

  -- Security can read expired.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', sec_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select count(*)::int into seen from public.safe_walks where id = expired_id;
  execute 'reset role';
  if seen <> 1 then
    raise exception 'security could not read expired Safe Walk';
  end if;

  -- 24 hour location cleanup.
  if (select last_lat from public.safe_walks where id = stale_id) is null then
    raise exception 'stale fixture missing location before cleanup';
  end if;
  cleaned := public.cleanup_safe_walk_locations();
  if cleaned < 1 then
    raise exception 'cleanup_safe_walk_locations changed no rows';
  end if;
  if (select last_lat from public.safe_walks where id = stale_id) is not null then
    raise exception 'location was not cleared 24 hours after close';
  end if;
  if (select last_lat from public.safe_walks where id = expired_id) is null then
    raise exception 'fresh expired location should remain until 24 hours pass';
  end if;

  delete from public.safe_walks where id in (active_id, expired_id, stale_id);
end $$;
