-- Prove a student cannot read another user's SOS under RLS (bypasses the UI).

do $$
declare
  amina_auth uuid := 'a1111111-1111-4111-8111-111111111101';
  other_id text := 'sos-rls-other';
  visible int := -1;
begin
  if not exists (select 1 from public.profiles where id = 'u-amina' and auth_user_id = amina_auth) then
    raise exception 'seed profile u-amina with known auth id is required';
  end if;
  if not exists (select 1 from public.profiles where id = 'u-yusuf') then
    raise exception 'seed profile u-yusuf is required';
  end if;

  delete from public.sos_alerts where id = other_id;
  insert into public.sos_alerts (id, user_id, sender_name, message, contacts, created_at)
  values (other_id, 'u-yusuf', 'Yusuf Ahmed', 'Safely SOS RLS isolation test.', '[]'::jsonb, now());

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', amina_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select count(*)::int into visible
  from public.sos_alerts
  where id = other_id;

  execute 'reset role';
  delete from public.sos_alerts where id = other_id;

  if visible <> 0 then
    raise exception 'student read another user SOS under RLS (count=%)', visible;
  end if;
end $$;
