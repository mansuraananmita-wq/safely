-- Daily report cap of 10, and a cap of 3 for 14 days after 3 flags in 30 days.
-- Anonymous flags must not expose the reporter to staff.

do $$
declare
  yusuf_auth uuid := 'a1111111-1111-4111-8111-111111111112';
  farzana_auth uuid := 'a1111111-1111-4111-8111-111111111113';
  admin_auth uuid := 'a1111111-1111-4111-8111-111111111104';
  used int;
  i int;
  stamp text := floor(extract(epoch from now()))::text;
  rid text;
  anon_id text;
  capped boolean;
  cap_message text;
  admin_hidden int;
  student_called boolean := false;
  tight timestamptz;
begin
  if not exists (select 1 from public.profiles where id = 'u-yusuf' and auth_user_id = yusuf_auth) then
    raise exception 'seed profile u-yusuf with known auth id is required';
  end if;
  if not exists (select 1 from public.profiles where id = 'u-farzana' and auth_user_id = farzana_auth) then
    raise exception 'seed profile u-farzana with known auth id is required';
  end if;

  delete from public.account_report_caps where user_id in ('u-yusuf', 'u-farzana');
  delete from public.reports where id like 'cap-test-%';

  -- General cap: 10 per account per day.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', yusuf_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select count(*)::int into used
  from (
    select r.id from public.reports r
    where r.reporter_id = 'u-yusuf' and r.created_at >= date_trunc('day', now())
    union
    select r.id from public.reports r
    join public.report_identities i on i.report_id = r.id
    where i.user_id = 'u-yusuf' and r.created_at >= date_trunc('day', now())
  ) owned;

  i := 0;
  while used < 10 loop
    i := i + 1;
    rid := 'cap-test-yusuf-' || stamp || '-' || i;
    insert into public.reports (
      id, title, description, category, location_id, location_detail, photos,
      confidential, anonymous, status, priority, reporter_id, created_at, updated_at, due_at
    ) values (
      rid,
      'Cap test report ' || i,
      'Daily cap fixture for a campus lighting problem near the library stairs.',
      'lighting',
      'library',
      'Stairwell',
      '[]'::jsonb,
      false,
      false,
      'submitted',
      'medium',
      'u-yusuf',
      now(),
      now(),
      now() + interval '2 days'
    );
    used := used + 1;
  end loop;

  capped := false;
  cap_message := '';
  begin
    insert into public.reports (
      id, title, description, category, location_id, location_detail, photos,
      confidential, anonymous, status, priority, reporter_id, created_at, updated_at, due_at
    ) values (
      'cap-test-yusuf-' || stamp || '-over',
      'Cap test over the limit',
      'This eleventh report today should be rejected by the daily cap trigger.',
      'lighting',
      'library',
      'Stairwell',
      '[]'::jsonb,
      false,
      false,
      'submitted',
      'medium',
      'u-yusuf',
      now(),
      now(),
      now() + interval '2 days'
    );
  exception when others then
    capped := true;
    cap_message := sqlerrm;
  end;
  execute 'reset role';

  if not capped or cap_message not like '%Daily report cap reached (10 per day)%' then
    raise exception 'daily cap of 10 did not block the extra report (%).', cap_message;
  end if;

  -- Three flags in 30 days, including one anonymous, tighten the cap to 3.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', farzana_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  anon_id := 'cap-test-farzana-anon-' || stamp;
  insert into public.reports (
    id, title, description, category, location_id, location_detail, photos,
    confidential, anonymous, status, priority, reporter_id, created_at, updated_at, due_at
  ) values (
    anon_id,
    'Anonymous cap fixture',
    'Anonymous content flagged without exposing the reporter to the desk.',
    'other',
    'cafe',
    'North window',
    '[]'::jsonb,
    true,
    true,
    'submitted',
    'low',
    'u-farzana',
    now() - interval '2 days',
    now() - interval '2 days',
    now()
  );
  for i in 1..2 loop
    insert into public.reports (
      id, title, description, category, location_id, location_detail, photos,
      confidential, anonymous, status, priority, reporter_id, created_at, updated_at, due_at
    ) values (
      'cap-test-farzana-' || stamp || '-' || i,
      'Named cap fixture ' || i,
      'Named content flagged so the account cap can be tested without today''s quota.',
      'other',
      'cafe',
      'North window',
      '[]'::jsonb,
      false,
      false,
      'submitted',
      'low',
      'u-farzana',
      now() - interval '2 days',
      now() - interval '2 days',
      now()
    );
  end loop;
  execute 'reset role';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', admin_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform public.flag_report(anon_id, 'malicious', 'Repeated false alarm');
  perform public.flag_report('cap-test-farzana-' || stamp || '-1', 'invalid', 'Not a campus problem');
  perform public.flag_report('cap-test-farzana-' || stamp || '-2', 'invalid', 'Duplicate of a closed case');

  admin_hidden := 0;
  begin
    select count(*)::int into admin_hidden from public.account_report_flags where user_id = 'u-farzana';
  exception when insufficient_privilege then
    admin_hidden := 0;
  end;
  begin
    perform public.account_recent_flag_count('u-farzana');
    student_called := true;
  exception when insufficient_privilege then
    student_called := false;
  end;
  execute 'reset role';

  if admin_hidden <> 0 then
    raise exception 'admin read account_report_flags (count=%)', admin_hidden;
  end if;
  if student_called then
    raise exception 'authenticated called account_recent_flag_count';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'report_flags' and column_name in ('user_id', 'reporter_id')
  ) then
    raise exception 'report_flags stores a reporter id';
  end if;
  if exists (
    select 1 from public.audit_log
    where target = anon_id
      and (action ilike '%u-farzana%' or action ilike '%Farzana%' or actor ilike '%Farzana%')
  ) then
    raise exception 'anonymous flag audit exposed the reporter';
  end if;
  if not exists (
    select 1 from public.audit_log
    where target = anon_id and action like 'Flagged anonymous report as malicious:%'
  ) then
    raise exception 'admin flag was not written to the audit log';
  end if;

  select tight_until into tight from public.account_report_caps where user_id = 'u-farzana';
  if tight is null or tight < now() + interval '13 days' then
    raise exception 'three flags in 30 days did not set a 14 day tight cap';
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', farzana_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select count(*)::int into used
  from (
    select r.id from public.reports r
    where r.reporter_id = 'u-farzana' and r.created_at >= date_trunc('day', now())
    union
    select r.id from public.reports r
    join public.report_identities i on i.report_id = r.id
    where i.user_id = 'u-farzana' and r.created_at >= date_trunc('day', now())
  ) owned;
  i := 0;
  while used < 3 loop
    i := i + 1;
    insert into public.reports (
      id, title, description, category, location_id, location_detail, photos,
      confidential, anonymous, status, priority, reporter_id, created_at, updated_at, due_at
    ) values (
      'cap-test-farzana-today-' || stamp || '-' || i,
      'Tight cap report ' || i,
      'Report filed while the 14 day tighter daily cap is active.',
      'other',
      'library',
      'Desk 2',
      '[]'::jsonb,
      false,
      false,
      'submitted',
      'low',
      'u-farzana',
      now(),
      now(),
      now() + interval '2 days'
    );
    used := used + 1;
  end loop;
  capped := false;
  cap_message := '';
  begin
    insert into public.reports (
      id, title, description, category, location_id, location_detail, photos,
      confidential, anonymous, status, priority, reporter_id, created_at, updated_at, due_at
    ) values (
      'cap-test-farzana-today-' || stamp || '-over',
      'Tight cap over the limit',
      'A fourth report today should fail while the tighter cap is active.',
      'other',
      'library',
      'Desk 2',
      '[]'::jsonb,
      false,
      false,
      'submitted',
      'low',
      'u-farzana',
      now(),
      now(),
      now() + interval '2 days'
    );
  exception when others then
    capped := true;
    cap_message := sqlerrm;
  end;
  execute 'reset role';

  if not capped or cap_message not like '%Daily report cap reached (3 per day)%' then
    raise exception 'tight cap of 3 did not block the extra report (%).', cap_message;
  end if;

  delete from public.account_report_caps where user_id in ('u-yusuf', 'u-farzana');
  delete from public.reports where id like 'cap-test-%';
  delete from public.audit_log where target like 'cap-test-%';
end $$;
