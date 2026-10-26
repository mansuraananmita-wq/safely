-- A signed-in user can write only their own device token.

do $$
declare
  amina_auth uuid := 'a1111111-1111-4111-8111-111111111101';
  karim_auth uuid := 'a1111111-1111-4111-8111-111111111102';
  sample text := 'dt-rls-test-token';
  seen int := -1;
begin
  if not exists (select 1 from public.profiles where id = 'u-amina' and auth_user_id = amina_auth) then
    raise exception 'seed profile u-amina with known auth id is required';
  end if;

  delete from public.device_tokens where token = sample;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', amina_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.device_tokens (user_id, token, platform, updated_at)
  values ('u-amina', sample, 'android', now());

  begin
    insert into public.device_tokens (user_id, token, platform, updated_at)
    values ('u-karim', 'dt-rls-other-token', 'ios', now());
  exception when insufficient_privilege or others then
    null;
  end;

  select count(*)::int into seen from public.device_tokens where token = sample;
  execute 'reset role';

  if exists (select 1 from public.device_tokens where token = 'dt-rls-other-token') then
    raise exception 'student wrote another user device token';
  end if;
  if seen <> 1 then
    raise exception 'student could not read own device token';
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', karim_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select count(*)::int into seen from public.device_tokens where token = sample;
  execute 'reset role';

  if seen <> 0 then
    raise exception 'student read another user device token';
  end if;

  delete from public.device_tokens where token in (sample, 'dt-rls-other-token');
end $$;
