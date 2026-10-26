-- Close SOS pins only. Neighbourhood / city / IP accuracy (over 150 m) cannot replace a live pin.

create or replace function public.sos_live_accuracy_ok(old_accuracy double precision, new_accuracy double precision)
returns boolean
language sql
immutable
as $$
  select new_accuracy is not null
    and new_accuracy > 0
    and new_accuracy <= 150
    and (
      old_accuracy is null
      or new_accuracy <= greatest(old_accuracy + 80, old_accuracy * 2)
    );
$$;
