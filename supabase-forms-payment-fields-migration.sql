-- NELPAC payment sender and configurable form responses migration.
-- Run once in the Supabase SQL Editor for an existing deployment.

alter table public.event_registrations
  add column if not exists payment_sender_name text,
  add column if not exists custom_field_responses jsonb not null default '{}'::jsonb,
  add column if not exists payment_shortfall numeric(12,2) not null default 0 check (payment_shortfall >= 0);

alter table public.merch_preorders
  add column if not exists payment_sender_name text,
  add column if not exists custom_field_responses jsonb not null default '{}'::jsonb,
  add column if not exists payment_shortfall numeric(12,2) not null default 0 check (payment_shortfall >= 0);

comment on column public.event_registrations.payment_sender_name is
  'Name shown on the submitted payment account or receipt.';
comment on column public.event_registrations.custom_field_responses is
  'Answers keyed by field ID from events.registration_form_config.';
comment on column public.merch_preorders.payment_sender_name is
  'Name shown on the submitted payment account or receipt.';
comment on column public.merch_preorders.custom_field_responses is
  'Answers keyed by field ID from merch_preorder_forms.form_config.';

comment on column public.event_registrations.payment_shortfall is
  'Admin-entered amount still lacking when payment_status is Partial (displayed as Verified Partial).';
comment on column public.merch_preorders.payment_shortfall is
  'Admin-entered amount still lacking when payment_status is Partial (displayed as Verified Partial).';

-- Legacy automatic statuses return to Pending for the new admin-reviewed flow.
alter table public.event_registrations disable trigger prepare_event_registration_trigger;
alter table public.merch_preorders disable trigger prepare_merch_preorder_trigger;

update public.event_registrations
set payment_status = 'Pending', payment_shortfall = 0
where payment_status = 'Paid';

update public.merch_preorders
set payment_status = 'Pending', payment_shortfall = 0
where payment_status = 'Paid';

alter table public.event_registrations enable trigger prepare_event_registration_trigger;
alter table public.merch_preorders enable trigger prepare_merch_preorder_trigger;

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

drop trigger if exists zz_enforce_event_payment_review on public.event_registrations;
create trigger zz_enforce_event_payment_review
before insert or update on public.event_registrations
for each row execute function public.enforce_payment_review_status();

drop trigger if exists zz_enforce_merch_payment_review on public.merch_preorders;
create trigger zz_enforce_merch_payment_review
before insert or update on public.merch_preorders
for each row execute function public.enforce_payment_review_status();

create or replace view public.event_registration_analytics
with (security_invoker = true)
as
select
  event.id as event_id,
  event.title as event_title,
  count(registration.id) filter (where registration.submission_status = 'Submitted') as registered_churches,
  coalesce(sum(registration.total_delegate_count) filter (where registration.submission_status = 'Submitted'), 0) as total_delegates,
  coalesce(sum(registration.male_delegate_count) filter (where registration.submission_status = 'Submitted'), 0) as male_delegates,
  coalesce(sum(registration.female_delegate_count) filter (where registration.submission_status = 'Submitted'), 0) as female_delegates,
  coalesce(sum(registration.expected_total) filter (where registration.submission_status = 'Submitted'), 0)::numeric(14,2) as total_expected_payment,
  coalesce(sum(registration.expected_total) filter (
    where registration.submission_status = 'Submitted'
      and registration.payment_status = 'Verified'
  ), 0)::numeric(14,2) as total_submitted_payment,
  count(registration.id) filter (
    where registration.submission_status = 'Submitted'
      and registration.payment_status = 'Verified'
  ) as paid_registrations,
  count(registration.id) filter (
    where registration.submission_status = 'Submitted'
      and registration.payment_status <> 'Verified'
  ) as unpaid_or_partial_registrations
from public.events event
left join public.event_registrations registration on registration.event_id = event.id
group by event.id, event.title;

create or replace view public.merch_preorder_analytics
with (security_invoker = true)
as
select
  form.id as form_id,
  form.title,
  form.merch_type,
  coalesce(form.custom_merch_name, form.merch_type::text) as merch_name,
  count(preorder.id) filter (where preorder.submission_status = 'Submitted') as churches_with_orders,
  coalesce(sum(preorder.total_quantity) filter (where preorder.submission_status = 'Submitted'), 0) as total_items_ordered,
  coalesce(sum(preorder.expected_total) filter (where preorder.submission_status = 'Submitted'), 0)::numeric(14,2) as total_expected_payment,
  coalesce(sum(preorder.expected_total) filter (
    where preorder.submission_status = 'Submitted'
      and preorder.payment_status = 'Verified'
  ), 0)::numeric(14,2) as total_submitted_payment,
  count(preorder.id) filter (
    where preorder.submission_status = 'Submitted'
      and preorder.payment_status = 'Verified'
  ) as paid_preorders,
  count(preorder.id) filter (
    where preorder.submission_status = 'Submitted'
      and preorder.payment_status <> 'Verified'
  ) as unpaid_or_partial_preorders
from public.merch_preorder_forms form
left join public.merch_preorders preorder on preorder.form_id = form.id
group by form.id, form.title, form.merch_type, form.custom_merch_name;
