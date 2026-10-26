-- Prove signed-in users can read app_settings; only admin can write.

do $$
declare
  amina_auth uuid := 'a1111111-1111-4111-8111-111111111101';
  admin_auth uuid := 'a1111111-1111-4111-8111-111111111104';
  insert_failed boolean := false;
  update_failed boolean := false;
  visible text;
  admin_ok boolean := false;
begin
  if not exists (select 1 from public.profiles where id = 'u-amina' and auth_user_id = amina_auth) then
    raise exception 'seed profile u-amina with known auth id is required';
  end if;
  if not exists (select 1 from public.profiles where id = 'u-admin' and auth_user_id = admin_auth) then
    raise exception 'seed profile u-admin with known auth id is required';
  end if;
  if not exists (select 1 from public.app_settings where key = 'security_sms_number') then
    raise exception 'app_settings row security_sms_number is required';
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', amina_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select value into visible from public.app_settings where key = 'security_sms_number';

  begin
    insert into public.app_settings (key, value) values ('student_inject', 'nope');
  exception when insufficient_privilege or others then
    insert_failed := true;
  end;

  begin
    update public.app_settings
    set value = '01700000000'
    where key = 'security_sms_number';
  exception when insufficient_privilege or others then
    update_failed := true;
  end;

  if not update_failed then
    if (select value from public.app_settings where key = 'security_sms_number') is not distinct from visible then
      update_failed := true;
    end if;
  end if;

  execute 'reset role';

  delete from public.app_settings where key = 'student_inject';

  if visible is null then
    raise exception 'student could not read security_sms_number';
  end if;
  if not insert_failed then
    raise exception 'student inserted into app_settings';
  end if;
  if not update_failed then
    raise exception 'student updated app_settings';
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', admin_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  update public.app_settings
  set value = '01799998888',
      updated_at = now()
  where key = 'security_sms_number';

  if (select value from public.app_settings where key = 'security_sms_number') = '01799998888' then
    admin_ok := true;
  end if;

  -- Restore placeholder so the linked project stays demo-safe.
  update public.app_settings
  set value = coalesce(nullif(visible, ''), '01XXXXXXXXX'),
      updated_at = now()
  where key = 'security_sms_number';

  execute 'reset role';

  if not admin_ok then
    raise exception 'admin could not update security_sms_number';
  end if;
end $$;
