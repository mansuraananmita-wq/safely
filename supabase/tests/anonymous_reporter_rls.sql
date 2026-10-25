-- Prove admin, security, and department selects see no reporter_id on anonymous reports,
-- and cannot read report_identities belonging to another user.

do $$
declare
  admin_auth uuid := 'a1111111-1111-4111-8111-111111111104';
  sec_auth uuid := 'a1111111-1111-4111-8111-111111111110';
  maint_auth uuid := 'a1111111-1111-4111-8111-111111111105';
  amina_auth uuid := 'a1111111-1111-4111-8111-111111111101';
  rid text := 'SF-ANON-RLS';
  admin_reporter text;
  sec_reporter text;
  dept_reporter text;
  admin_idents int := -1;
  sec_idents int := -1;
  dept_idents int := -1;
  owner_idents int := -1;
begin
  if not exists (select 1 from public.profiles where id = 'u-amina' and auth_user_id = amina_auth) then
    raise exception 'seed profile u-amina with known auth id is required';
  end if;
  if not exists (select 1 from public.profiles where id = 'u-admin' and auth_user_id = admin_auth) then
    raise exception 'seed profile u-admin with known auth id is required';
  end if;
  if not exists (select 1 from public.profiles where id = 'u-sec' and auth_user_id = sec_auth) then
    raise exception 'seed profile u-sec with known auth id is required';
  end if;
  if not exists (select 1 from public.profiles where id = 'u-maint' and auth_user_id = maint_auth) then
    raise exception 'seed profile u-maint with known auth id is required';
  end if;

  delete from public.reports where id = rid;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', amina_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.reports (
    id, title, description, category, location_id, location_detail, photos,
    confidential, anonymous, status, priority, reporter_id, created_at, updated_at, due_at
  ) values (
    rid,
    'Anonymous RLS isolation case',
    'Enough detail for the desk to understand the place and the urgency of the case.',
    'harassment',
    'cafe',
    'Not tied to a room',
    '[]'::jsonb,
    true,
    true,
    'submitted',
    'urgent',
    'u-amina',
    now(),
    now(),
    now() + interval '1 day'
  );

  execute 'reset role';

  if exists (select 1 from public.reports where id = rid and reporter_id is not null) then
    raise exception 'anonymous report kept reporter_id on reports row';
  end if;
  if not exists (select 1 from public.report_identities where report_id = rid and user_id = 'u-amina') then
    raise exception 'anonymous report missing private identity row';
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', admin_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select reporter_id into admin_reporter from public.reports where id = rid;
  select count(*)::int into admin_idents from public.report_identities where report_id = rid;
  execute 'reset role';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', sec_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select reporter_id into sec_reporter from public.reports where id = rid;
  select count(*)::int into sec_idents from public.report_identities where report_id = rid;
  execute 'reset role';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', maint_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select reporter_id into dept_reporter from public.reports where id = rid;
  select count(*)::int into dept_idents from public.report_identities where report_id = rid;
  execute 'reset role';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', amina_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select count(*)::int into owner_idents from public.report_identities where report_id = rid;
  execute 'reset role';

  delete from public.reports where id = rid;

  if admin_reporter is not null then
    raise exception 'admin select returned reporter for anonymous report';
  end if;
  if sec_reporter is not null then
    raise exception 'security select returned reporter for anonymous report';
  end if;
  if dept_reporter is not null then
    raise exception 'department select returned reporter for anonymous report';
  end if;
  if admin_idents <> 0 then
    raise exception 'admin read report_identities (count=%)', admin_idents;
  end if;
  if sec_idents <> 0 then
    raise exception 'security read report_identities (count=%)', sec_idents;
  end if;
  if dept_idents <> 0 then
    raise exception 'department read report_identities (count=%)', dept_idents;
  end if;
  if owner_idents <> 1 then
    raise exception 'owner could not read own report_identities (count=%)', owner_idents;
  end if;
end $$;
