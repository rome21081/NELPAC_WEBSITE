-- NELPAC GCash payment redirection and manual verification migration.
-- Run after the event/merch form, supplements, onsite, and payment review migrations.

create extension if not exists "pgcrypto";

-- Payment destinations remain lightweight for Supabase Free Tier. A future
-- gateway can replace these URLs with provider checkout/session URLs.
alter table public.events
  add column if not exists registration_payment_provider text not null default 'manual-gcash',
  add column if not exists registration_payment_webhook_enabled boolean not null default false;

alter table public.merch_preorder_forms
  add column if not exists payment_provider text not null default 'manual-gcash',
  add column if not exists payment_webhook_enabled boolean not null default false;

alter table public.event_registrations
  add column if not exists payment_provider text not null default 'manual-gcash',
  add column if not exists payment_gateway_reference text,
  add column if not exists payment_verified_at timestamptz,
  add column if not exists payment_verified_by uuid references public.profiles(id) on delete set null;

alter table public.merch_preorders
  add column if not exists payment_provider text not null default 'manual-gcash',
  add column if not exists payment_gateway_reference text,
  add column if not exists payment_verified_at timestamptz,
  add column if not exists payment_verified_by uuid references public.profiles(id) on delete set null;

alter table public.event_registration_supplements
  add column if not exists admin_notes text,
  add column if not exists payment_provider text not null default 'manual-gcash',
  add column if not exists payment_gateway_reference text,
  add column if not exists payment_verified_at timestamptz,
  add column if not exists payment_verified_by uuid references public.profiles(id) on delete set null;

alter table public.merch_preorder_supplements
  add column if not exists admin_notes text,
  add column if not exists payment_provider text not null default 'manual-gcash',
  add column if not exists payment_gateway_reference text,
  add column if not exists payment_verified_at timestamptz,
  add column if not exists payment_verified_by uuid references public.profiles(id) on delete set null;

create index if not exists event_registrations_payment_review_idx
on public.event_registrations(payment_status, submitted_at)
where submission_status = 'Submitted';

create index if not exists merch_preorders_payment_review_idx
on public.merch_preorders(payment_status, submitted_at)
where submission_status = 'Submitted';

create index if not exists event_supplements_payment_review_idx
on public.event_registration_supplements(payment_status, submitted_at);

create index if not exists merch_supplements_payment_review_idx
on public.merch_preorder_supplements(payment_status, submitted_at);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'manual-gcash',
  module text not null check (module in ('event-registration', 'onsite-registration', 'merch-preorder')),
  source_table text not null check (source_table in (
    'event_registrations',
    'event_registration_supplements',
    'merch_preorders',
    'merch_preorder_supplements'
  )),
  source_id uuid not null,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  payer_name text,
  transaction_reference text,
  payment_date date,
  proof_bucket text not null,
  proof_path text,
  status public.form_payment_status not null default 'Pending',
  gateway_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(gateway_payload) = 'object'),
  admin_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_transactions_source_idx
on public.payment_transactions(source_table, source_id);

create index if not exists payment_transactions_review_idx
on public.payment_transactions(status, created_at);

alter table public.payment_transactions enable row level security;

drop policy if exists "payment_transactions_select_own_or_admin" on public.payment_transactions;
create policy "payment_transactions_select_own_or_admin"
on public.payment_transactions for select
to authenticated
using (submitted_by = auth.uid() or public.is_admin());

drop policy if exists "payment_transactions_insert_own" on public.payment_transactions;
create policy "payment_transactions_insert_own"
on public.payment_transactions for insert
to authenticated
with check (submitted_by = auth.uid() or public.is_admin());

drop policy if exists "payment_transactions_update_admin" on public.payment_transactions;
create policy "payment_transactions_update_admin"
on public.payment_transactions for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop trigger if exists set_payment_transactions_updated_at on public.payment_transactions;
create trigger set_payment_transactions_updated_at
before update on public.payment_transactions
for each row execute function public.set_updated_at();

create or replace function public.touch_payment_review_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin()
    and tg_op = 'UPDATE'
    and new.payment_status is distinct from old.payment_status
    and new.payment_status in ('Verified', 'Partial', 'Rejected')
  then
    new.payment_verified_at := now();
    new.payment_verified_by := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists zzz_touch_event_payment_review on public.event_registrations;
create trigger zzz_touch_event_payment_review
before update on public.event_registrations
for each row execute function public.touch_payment_review_metadata();

drop trigger if exists zzz_touch_merch_payment_review on public.merch_preorders;
create trigger zzz_touch_merch_payment_review
before update on public.merch_preorders
for each row execute function public.touch_payment_review_metadata();

drop trigger if exists zzz_touch_event_supplement_payment_review on public.event_registration_supplements;
create trigger zzz_touch_event_supplement_payment_review
before update on public.event_registration_supplements
for each row execute function public.touch_payment_review_metadata();

drop trigger if exists zzz_touch_merch_supplement_payment_review on public.merch_preorder_supplements;
create trigger zzz_touch_merch_supplement_payment_review
before update on public.merch_preorder_supplements
for each row execute function public.touch_payment_review_metadata();

comment on table public.payment_transactions is
  'Gateway-ready payment ledger. Manual GCash proof submissions are stored here today; webhook-confirmed gateway events can use the same source_table/source_id association later.';
comment on column public.payment_transactions.gateway_payload is
  'Raw provider payload for future PayMongo, Xendit, Maya, or GCash Merchant API webhook reconciliation.';

-- Supersedes the older onsite migration behavior that forced every onsite
-- registration to Cash and cleared proof_of_payment_url.
create or replace function public.prepare_event_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_record public.events;
  delegate_rows integer;
  male_rows integer;
  female_rows integer;
  onsite_is_open boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into event_record from public.events where id = new.event_id;
  if event_record.id is null then raise exception 'Event not found'; end if;

  if tg_op = 'INSERT' then
    if not public.is_admin() then new.submitted_by := auth.uid(); end if;
    new.fee_per_delegate := event_record.registration_fee;
    new.payment_provider := coalesce(new.payment_provider, event_record.registration_payment_provider, 'manual-gcash');
  else
    new.event_id := old.event_id;
    new.submitted_by := old.submitted_by;
    new.local_church_id := old.local_church_id;
    new.registration_type := old.registration_type;
    new.fee_per_delegate := old.fee_per_delegate;
    new.payment_provider := coalesce(new.payment_provider, old.payment_provider, 'manual-gcash');
    if not public.is_admin() and old.submission_status <> 'Draft' then
      raise exception 'Only draft registrations can be edited';
    end if;
  end if;

  if not public.is_admin() then
    if new.registration_type = 'Onsite' then
      onsite_is_open := event_record.status = 'Published'
        and event_record.onsite_registration_enabled
        and (
          event_record.onsite_registration_mode = 'Manual'
          or (now() at time zone 'Asia/Manila')::date >= event_record.event_date
        );
      if not onsite_is_open then
        raise exception 'Onsite registration is not open for this event';
      end if;
    else
      if event_record.status <> 'Published' or not event_record.pre_registration_enabled then
        raise exception 'Pre-registration is not open for this event';
      end if;
      if event_record.registration_deadline is not null and now() > event_record.registration_deadline then
        raise exception 'The pre-registration deadline has passed';
      end if;
    end if;
    new.payment_status := 'Pending';
    new.payment_shortfall := 0;
    new.amount_paid := 0;
    new.admin_notes := case when tg_op = 'UPDATE' then old.admin_notes else null end;
  end if;

  if new.submission_status = 'Submitted' then
    if tg_op = 'INSERT' then
      raise exception 'Create the draft and delegate rows before submitting the registration';
    end if;
    select count(*), count(*) filter (where gender = 'Male'), count(*) filter (where gender = 'Female')
      into delegate_rows, male_rows, female_rows
    from public.event_registration_delegates where registration_id = old.id;
    if delegate_rows <= 0 then raise exception 'At least one delegate must be added before submitting'; end if;
    new.male_delegate_count := male_rows;
    new.female_delegate_count := female_rows;
    new.submitted_at := coalesce(old.submitted_at, now());
  elsif new.submission_status = 'Draft' then
    new.submitted_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.validate_event_registration_supplement_availability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_type text;
  parent_event_id uuid;
  event_record public.events;
begin
  if public.is_admin() then return new; end if;
  select registration.registration_type, registration.event_id
    into parent_type, parent_event_id
  from public.event_registrations registration
  where registration.id = new.registration_id
    and registration.submitted_by = auth.uid();

  select * into event_record from public.events where id = parent_event_id;
  if event_record.id is null then raise exception 'Registration not found'; end if;

  if parent_type = 'Onsite' then
    if event_record.status <> 'Published'
      or not event_record.onsite_registration_enabled
      or (event_record.onsite_registration_mode = 'Automatic'
        and (now() at time zone 'Asia/Manila')::date < event_record.event_date)
    then raise exception 'Onsite registration is not open for this event'; end if;
  else
    if event_record.status <> 'Published' or not event_record.pre_registration_enabled
      or (event_record.registration_deadline is not null and now() > event_record.registration_deadline)
    then raise exception 'Pre-registration is not open for this event'; end if;
  end if;
  new.payment_provider := coalesce(new.payment_provider, 'manual-gcash');
  return new;
end;
$$;
