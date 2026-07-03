-- NELPAC append-only supplemental submissions.
-- Keeps one parent record per event/form and local church while preserving
-- every later submission and payment as a separate child record.

create table if not exists public.event_registration_supplements (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.event_registrations(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  submission_details jsonb not null default '{}'::jsonb check (jsonb_typeof(submission_details) = 'object'),
  delegates jsonb not null default '[]'::jsonb check (jsonb_typeof(delegates) = 'array'),
  male_delegate_count integer not null default 0 check (male_delegate_count >= 0),
  female_delegate_count integer not null default 0 check (female_delegate_count >= 0),
  total_delegate_count integer generated always as (male_delegate_count + female_delegate_count) stored,
  fee_per_delegate numeric(12,2) not null check (fee_per_delegate >= 0),
  expected_total numeric(12,2) generated always as (
    (male_delegate_count + female_delegate_count) * fee_per_delegate
  ) stored,
  gcash_mode_of_payment text,
  payment_sender_name text,
  proof_of_payment_url text not null,
  payment_date date,
  reference_number text,
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  payment_shortfall numeric(12,2) not null default 0 check (payment_shortfall >= 0),
  payment_status public.form_payment_status not null default 'Pending',
  custom_field_responses jsonb not null default '{}'::jsonb check (jsonb_typeof(custom_field_responses) = 'object'),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.merch_preorder_supplements (
  id uuid primary key default gen_random_uuid(),
  preorder_id uuid not null references public.merch_preorders(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  submission_details jsonb not null default '{}'::jsonb check (jsonb_typeof(submission_details) = 'object'),
  order_items jsonb not null default '[]'::jsonb check (jsonb_typeof(order_items) = 'array'),
  total_quantity integer not null check (total_quantity > 0),
  fee_per_item numeric(12,2) not null check (fee_per_item >= 0),
  expected_total numeric(12,2) generated always as (total_quantity * fee_per_item) stored,
  gcash_mode_of_payment text,
  payment_sender_name text,
  proof_of_payment_url text not null,
  payment_date date,
  reference_number text,
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  payment_shortfall numeric(12,2) not null default 0 check (payment_shortfall >= 0),
  payment_status public.form_payment_status not null default 'Pending',
  custom_field_responses jsonb not null default '{}'::jsonb check (jsonb_typeof(custom_field_responses) = 'object'),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_registration_supplements_parent_idx
on public.event_registration_supplements(registration_id, submitted_at);
create index if not exists merch_preorder_supplements_parent_idx
on public.merch_preorder_supplements(preorder_id, submitted_at);

drop trigger if exists set_event_registration_supplements_updated_at
on public.event_registration_supplements;
create trigger set_event_registration_supplements_updated_at
before update on public.event_registration_supplements
for each row execute function public.set_updated_at();

drop trigger if exists set_merch_preorder_supplements_updated_at
on public.merch_preorder_supplements;
create trigger set_merch_preorder_supplements_updated_at
before update on public.merch_preorder_supplements
for each row execute function public.set_updated_at();

create or replace function public.enforce_supplement_payment_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare expected_amount numeric; row_data jsonb;
begin
  row_data := to_jsonb(new);
  if tg_table_name = 'event_registration_supplements' then
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
    new.submitted_by := auth.uid();
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

drop trigger if exists enforce_event_supplement_payment_review
on public.event_registration_supplements;
create trigger enforce_event_supplement_payment_review
before insert or update on public.event_registration_supplements
for each row execute function public.enforce_supplement_payment_review();

drop trigger if exists enforce_merch_supplement_payment_review
on public.merch_preorder_supplements;
create trigger enforce_merch_supplement_payment_review
before insert or update on public.merch_preorder_supplements
for each row execute function public.enforce_supplement_payment_review();

alter table public.event_registration_supplements enable row level security;
alter table public.merch_preorder_supplements enable row level security;

drop policy if exists "event_supplements_select_own_or_admin" on public.event_registration_supplements;
create policy "event_supplements_select_own_or_admin"
on public.event_registration_supplements for select to authenticated
using (submitted_by = auth.uid() or public.is_admin());

drop policy if exists "event_supplements_insert_own" on public.event_registration_supplements;
create policy "event_supplements_insert_own"
on public.event_registration_supplements for insert to authenticated
with check (
  submitted_by = auth.uid()
  and exists (
    select 1 from public.event_registrations parent
    where parent.id = registration_id
      and parent.submitted_by = auth.uid()
      and parent.submission_status = 'Submitted'
  )
);

drop policy if exists "event_supplements_update_admin" on public.event_registration_supplements;
create policy "event_supplements_update_admin"
on public.event_registration_supplements for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "merch_supplements_select_own_or_admin" on public.merch_preorder_supplements;
create policy "merch_supplements_select_own_or_admin"
on public.merch_preorder_supplements for select to authenticated
using (submitted_by = auth.uid() or public.is_admin());

drop policy if exists "merch_supplements_insert_own" on public.merch_preorder_supplements;
create policy "merch_supplements_insert_own"
on public.merch_preorder_supplements for insert to authenticated
with check (
  submitted_by = auth.uid()
  and exists (
    select 1 from public.merch_preorders parent
    where parent.id = preorder_id
      and parent.submitted_by = auth.uid()
      and parent.submission_status = 'Submitted'
  )
);

drop policy if exists "merch_supplements_update_admin" on public.merch_preorder_supplements;
create policy "merch_supplements_update_admin"
on public.merch_preorder_supplements for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create or replace function public.notify_admins_for_event_supplement()
returns trigger language plpgsql security definer set search_path = public as $$
declare event_title text; church_name text;
begin
  select event.title, church.name into event_title, church_name
  from public.event_registrations parent
  join public.events event on event.id = parent.event_id
  join public.local_churches church on church.id = parent.local_church_id
  where parent.id = new.registration_id;
  insert into public.notifications (user_id, title, message, type)
  select profile.id, 'Additional pre-registration submitted',
    coalesce(church_name, 'A local church') || ' added another submission for ' || coalesce(event_title, 'an event') || '.', 'system'
  from public.profiles profile where profile.role = 'admin';
  return new;
end; $$;

drop trigger if exists notify_admins_for_event_supplement_trigger on public.event_registration_supplements;
create trigger notify_admins_for_event_supplement_trigger
after insert on public.event_registration_supplements
for each row execute function public.notify_admins_for_event_supplement();

create or replace function public.notify_admins_for_merch_supplement()
returns trigger language plpgsql security definer set search_path = public as $$
declare form_title text; church_name text;
begin
  select form.title, church.name into form_title, church_name
  from public.merch_preorders parent
  join public.merch_preorder_forms form on form.id = parent.form_id
  join public.local_churches church on church.id = parent.local_church_id
  where parent.id = new.preorder_id;
  insert into public.notifications (user_id, title, message, type)
  select profile.id, 'Additional merch pre-order submitted',
    coalesce(church_name, 'A local church') || ' added another order for ' || coalesce(form_title, 'a merch form') || '.', 'system'
  from public.profiles profile where profile.role = 'admin';
  return new;
end; $$;

drop trigger if exists notify_admins_for_merch_supplement_trigger on public.merch_preorder_supplements;
create trigger notify_admins_for_merch_supplement_trigger
after insert on public.merch_preorder_supplements
for each row execute function public.notify_admins_for_merch_supplement();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_registration_supplements') then
    alter publication supabase_realtime add table public.event_registration_supplements;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'merch_preorder_supplements') then
    alter publication supabase_realtime add table public.merch_preorder_supplements;
  end if;
end; $$;

create or replace view public.event_registration_analytics
with (security_invoker = true)
as
select
  event.id as event_id,
  event.title as event_title,
  count(parent.id) filter (where parent.submission_status = 'Submitted') as registered_churches,
  coalesce(sum(
    parent.total_delegate_count + coalesce((
      select sum(extra.total_delegate_count)
      from public.event_registration_supplements extra
      where extra.registration_id = parent.id
    ), 0)
  ) filter (where parent.submission_status = 'Submitted'), 0)::bigint as total_delegates,
  coalesce(sum(
    parent.male_delegate_count + coalesce((select sum(extra.male_delegate_count) from public.event_registration_supplements extra where extra.registration_id = parent.id), 0)
  ) filter (where parent.submission_status = 'Submitted'), 0)::bigint as male_delegates,
  coalesce(sum(
    parent.female_delegate_count + coalesce((select sum(extra.female_delegate_count) from public.event_registration_supplements extra where extra.registration_id = parent.id), 0)
  ) filter (where parent.submission_status = 'Submitted'), 0)::bigint as female_delegates,
  coalesce(sum(
    parent.expected_total + coalesce((select sum(extra.expected_total) from public.event_registration_supplements extra where extra.registration_id = parent.id), 0)
  ) filter (where parent.submission_status = 'Submitted'), 0)::numeric(14,2) as total_expected_payment,
  coalesce(sum(
    case when parent.payment_status = 'Verified' then parent.expected_total else 0 end
    + coalesce((select sum(extra.expected_total) from public.event_registration_supplements extra where extra.registration_id = parent.id and extra.payment_status = 'Verified'), 0)
  ) filter (where parent.submission_status = 'Submitted'), 0)::numeric(14,2) as total_submitted_payment,
  count(parent.id) filter (where parent.submission_status = 'Submitted' and parent.payment_status = 'Verified') as paid_registrations,
  count(parent.id) filter (where parent.submission_status = 'Submitted' and parent.payment_status <> 'Verified') as unpaid_or_partial_registrations
from public.events event
left join public.event_registrations parent on parent.event_id = event.id
group by event.id, event.title;

create or replace view public.merch_preorder_analytics
with (security_invoker = true)
as
select
  form.id as form_id,
  form.title,
  form.merch_type,
  coalesce(form.custom_merch_name, form.merch_type::text) as merch_name,
  count(parent.id) filter (where parent.submission_status = 'Submitted') as churches_with_orders,
  coalesce(sum(
    parent.total_quantity + coalesce((select sum(extra.total_quantity) from public.merch_preorder_supplements extra where extra.preorder_id = parent.id), 0)
  ) filter (where parent.submission_status = 'Submitted'), 0)::bigint as total_items_ordered,
  coalesce(sum(
    parent.expected_total + coalesce((select sum(extra.expected_total) from public.merch_preorder_supplements extra where extra.preorder_id = parent.id), 0)
  ) filter (where parent.submission_status = 'Submitted'), 0)::numeric(14,2) as total_expected_payment,
  coalesce(sum(
    case when parent.payment_status = 'Verified' then parent.expected_total else 0 end
    + coalesce((select sum(extra.expected_total) from public.merch_preorder_supplements extra where extra.preorder_id = parent.id and extra.payment_status = 'Verified'), 0)
  ) filter (where parent.submission_status = 'Submitted'), 0)::numeric(14,2) as total_submitted_payment,
  count(parent.id) filter (where parent.submission_status = 'Submitted' and parent.payment_status = 'Verified') as paid_preorders,
  count(parent.id) filter (where parent.submission_status = 'Submitted' and parent.payment_status <> 'Verified') as unpaid_or_partial_preorders
from public.merch_preorder_forms form
left join public.merch_preorders parent on parent.form_id = form.id
group by form.id, form.title, form.merch_type, form.custom_merch_name;
