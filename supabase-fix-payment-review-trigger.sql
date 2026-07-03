-- Fix the shared payment review trigger for both registration table shapes.
-- Run this once in the Supabase SQL Editor on an existing deployment.

create or replace function public.enforce_payment_review_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_amount numeric;
  row_data jsonb;
begin
  row_data := to_jsonb(new);

  if tg_table_name = 'event_registrations' then
    expected_amount := (
      coalesce((row_data ->> 'male_delegate_count')::numeric, 0)
      + coalesce((row_data ->> 'female_delegate_count')::numeric, 0)
    ) * coalesce((row_data ->> 'fee_per_delegate')::numeric, 0);
  else
    expected_amount :=
      coalesce((row_data ->> 'total_quantity')::numeric, 0)
      * coalesce((row_data ->> 'fee_per_item')::numeric, 0);
  end if;

  if not public.is_admin() then
    new.payment_status := 'Pending';
    new.payment_shortfall := 0;
    new.amount_paid := 0;
  elsif new.payment_status = 'Partial' then
    if new.payment_shortfall <= 0 or new.payment_shortfall >= expected_amount then
      raise exception 'Verified Partial requires a shortfall greater than zero and below the expected total';
    end if;
    new.amount_paid := expected_amount - new.payment_shortfall;
  elsif new.payment_status = 'Verified' then
    new.payment_shortfall := 0;
    new.amount_paid := expected_amount;
  else
    new.payment_shortfall := 0;
    new.amount_paid := 0;
  end if;

  return new;
end;
$$;
