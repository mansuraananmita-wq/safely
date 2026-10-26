-- Two-person reveal: same person cannot approve; unrelated roles cannot request.

do $$
declare
  admin_auth uuid := 'a1111111-1111-4111-8111-111111111104';
  affairs_auth uuid := 'a1111111-1111-4111-8111-111111111111';
  sec_auth uuid := 'a1111111-1111-4111-8111-111111111110';
  maint_auth uuid := 'a1111111-1111-4111-8111-111111111105';
  rid text := 'SF-REVEAL-DUAL';
  req_id text;
  self_ok boolean := false;
  sec_blocked boolean := false;
  maint_blocked boolean := false;
  revealed_count int := 0;
begin
  if not exists (select 1 from public.profiles where id = 'u-admin' and auth_user_id = admin_auth) then
    raise exception 'seed profile u-admin with known auth id is required';
  end if;
  if not exists (select 1 from public.profiles where id = 'u-affairs' and auth_user_id = affairs_auth) then
    raise exception 'seed profile u-affairs with known auth id is required';
  end if;

  delete from public.reveal_requests where report_id = rid;
  delete from public.report_identities where report_id = rid;
  delete from public.report_activities where report_id = rid;
  delete from public.notifications where href = '/app/reports/' || rid;
  delete from public.reports where id = rid;

  insert into public.reports (
    id, title, description, category, location_id, location_detail, photos,
    confidential, anonymous, status, priority, department_id, reporter_id,
    created_at, updated_at, due_at, info_requested, blocks_access, contact_window
  ) values (
    rid,
    'Dual control reveal fixture',
    'Anonymous harassment fixture used only for reveal approval tests.',
    'harassment',
    'science',
    'Lab corridor',
    '[]'::jsonb,
    true,
    true,
    'under_review',
    'urgent',
    null,
    null,
    now(),
    now(),
    now() + interval '1 day',
    false,
    false,
    ''
  );
  insert into public.report_identities (report_id, user_id) values (rid, 'u-amina');

  -- Security cannot request.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', sec_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  begin
    perform public.request_reveal(rid, 'Security tries to open identity');
  exception when others then
    sec_blocked := true;
  end;
  execute 'reset role';

  -- Maintenance department cannot request.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', maint_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  begin
    perform public.request_reveal(rid, 'Maintenance tries to open identity');
  exception when others then
    maint_blocked := true;
  end;
  execute 'reset role';

  if not sec_blocked then
    raise exception 'security requested a reveal';
  end if;
  if not maint_blocked then
    raise exception 'unrelated department requested a reveal';
  end if;

  -- Admin requests.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', admin_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select id into req_id from public.request_reveal(rid, 'Need identity for safety follow-up');
  execute 'reset role';

  if req_id is null then
    raise exception 'admin request_reveal returned no id';
  end if;

  -- Same admin cannot approve.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', admin_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  begin
    perform public.decide_reveal_request(req_id, 'approved');
  exception when others then
    self_ok := true;
  end;
  execute 'reset role';

  if not self_ok then
    raise exception 'requester approved their own reveal request';
  end if;

  -- Affairs approves, then reveal works.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', affairs_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform public.decide_reveal_request(req_id, 'approved');
  perform public.reveal_reporter(rid, 'Opening after dual approval');
  select count(*)::int into revealed_count
  from public.reveal_reporter(rid, 'Opening after dual approval again');
  execute 'reset role';

  if revealed_count < 1 then
    raise exception 'reveal_reporter returned no identity after approval';
  end if;
  if not exists (
    select 1 from public.report_identities
    where report_id = rid and revealed_at is not null
  ) then
    raise exception 'revealed_at was not set for the reporter';
  end if;
  if not exists (
    select 1 from public.audit_log
    where target = rid and action like 'Requested anonymous reveal%'
  ) then
    raise exception 'request was not audited';
  end if;
  if not exists (
    select 1 from public.audit_log
    where target = rid and action like 'Approved anonymous reveal%'
  ) then
    raise exception 'approval was not audited';
  end if;
  if not exists (
    select 1 from public.audit_log
    where target = rid and action like 'Revealed anonymous reporter%'
  ) then
    raise exception 'reveal was not audited';
  end if;

  delete from public.reveal_requests where report_id = rid;
  delete from public.report_identities where report_id = rid;
  delete from public.notifications where href = '/app/reports/' || rid;
  delete from public.reports where id = rid;
end $$;
