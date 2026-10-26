-- Movement with similar GPS accuracy is a live share. A city-wide guess is not.

do $$
begin
  if public.sos_live_accuracy_ok(20, 22) is not true then
    raise exception 'similar GPS accuracy after a short move should be ok';
  end if;
  if public.sos_live_accuracy_ok(12, 8) is not true then
    raise exception 'a closer GPS reading should be ok';
  end if;
  if public.sos_live_accuracy_ok(null, 18) is not true then
    raise exception 'first close pin should be ok';
  end if;
  if public.sos_live_accuracy_ok(20, 8000) is not false then
    raise exception 'city or IP accuracy should be rejected';
  end if;
  if public.sos_live_accuracy_ok(15, 400) is not false then
    raise exception 'a much worse later guess should be rejected';
  end if;
  if public.sos_live_accuracy_ok(30, 0) is not false then
    raise exception 'zero accuracy should be rejected';
  end if;
end $$;
