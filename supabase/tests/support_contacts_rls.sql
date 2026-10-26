-- Prove a student cannot insert or update support_contacts under RLS.

do $$
declare
  amina_auth uuid := 'a1111111-1111-4111-8111-111111111101';
  insert_failed boolean := false;
  update_failed boolean := false;
  visible int := -1;
begin
  if not exists (select 1 from public.profiles where id = 'u-amina' and auth_user_id = amina_auth) then
    raise exception 'seed profile u-amina with known auth id is required';
  end if;
  if not exists (select 1 from public.support_contacts where id = 'sc-emergency-999') then
    raise exception 'support_contacts seed row sc-emergency-999 is required';
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', amina_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  begin
    insert into public.support_contacts (
      id, name_en, name_bn, category, phone, description_en, description_bn, is_active, sort_order
    ) values (
      'sc-student-inject',
      'Student inject',
      'শিক্ষার্থী ইনজেক্ট',
      'health',
      '01700000000',
      'should fail',
      'should fail',
      true,
      99
    );
  exception when insufficient_privilege or others then
    insert_failed := true;
  end;

  begin
    update public.support_contacts
    set phone = '01711111111'
    where id = 'sc-emergency-999';
  exception when insufficient_privilege or others then
    update_failed := true;
  end;

  -- If RLS silently blocked the update (0 rows), treat as failure for the attacker.
  if not update_failed then
    if (select phone from public.support_contacts where id = 'sc-emergency-999') = '999' then
      update_failed := true;
    end if;
  end if;

  select count(*)::int into visible
  from public.support_contacts
  where is_active = true;

  execute 'reset role';

  delete from public.support_contacts where id = 'sc-student-inject';

  if not insert_failed then
    raise exception 'student inserted into support_contacts';
  end if;
  if not update_failed then
    raise exception 'student updated support_contacts';
  end if;
  if visible < 1 then
    raise exception 'student could not read active support_contacts';
  end if;
end $$;
