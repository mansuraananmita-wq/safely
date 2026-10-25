-- Database-level SOS rate limit, bypassing the UI.
-- Expects profiles.id = 'u-amina' from seed. Cleans up its own rows.

do $$
declare
  first_id text := 'sos-rate-test-1';
  second_id text := 'sos-rate-test-2';
  blocked boolean := false;
begin
  if not exists (select 1 from public.profiles where id = 'u-amina') then
    raise exception 'seed profile u-amina is required for this test';
  end if;

  delete from public.sos_alerts where id in (first_id, second_id);

  insert into public.sos_alerts (id, user_id, sender_name, message, contacts, created_at)
  values (first_id, 'u-amina', 'Amina Rahman', 'Safely SOS rate-limit test.', '[]'::jsonb, now());

  begin
    insert into public.sos_alerts (id, user_id, sender_name, message, contacts, created_at)
    values (second_id, 'u-amina', 'Amina Rahman', 'Safely SOS rate-limit test.', '[]'::jsonb, now());
  exception
    when others then
      if sqlerrm like '%Wait a minute before sending another SOS%' then
        blocked := true;
      else
        raise;
      end if;
  end;

  delete from public.sos_alerts where id in (first_id, second_id);

  if not blocked then
    raise exception 'expected second SOS insert within 60 seconds to fail at the database';
  end if;
end $$;
