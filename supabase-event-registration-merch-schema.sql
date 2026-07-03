-- NELPAC Event Pre-Registration and Merch Pre-Order schema
--
-- Run supabase-schema.sql first, then paste this entire file into the
-- Supabase SQL Editor. This migration is additive and can be run again safely.

create extension if not exists "pgcrypto";

-- ============================================================
-- Storage
-- ============================================================

insert into storage.buckets (id, name, public)
values
  ('merch-images', 'merch-images', true),
  ('registration-payment-proofs', 'registration-payment-proofs', false),
  ('merch-payment-proofs', 'merch-payment-proofs', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "merch_images_public_read" on storage.objects;
create policy "merch_images_public_read"
on storage.objects for select
to public
using (bucket_id = 'merch-images');

drop policy if exists "merch_images_admin_insert" on storage.objects;
create policy "merch_images_admin_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'merch-images' and public.is_admin());

drop policy if exists "merch_images_admin_update" on storage.objects;
create policy "merch_images_admin_update"
on storage.objects for update
to authenticated
using (bucket_id = 'merch-images' and public.is_admin())
with check (bucket_id = 'merch-images' and public.is_admin());

drop policy if exists "merch_images_admin_delete" on storage.objects;
create policy "merch_images_admin_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'merch-images' and public.is_admin());

drop policy if exists "registration_proofs_read_own_or_admin" on storage.objects;
create policy "registration_proofs_read_own_or_admin"
on storage.objects for select
to authenticated
using (
  bucket_id = 'registration-payment-proofs'
  and (
    public.is_admin()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

drop policy if exists "registration_proofs_insert_own" on storage.objects;
create policy "registration_proofs_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'registration-payment-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "registration_proofs_update_own_or_admin" on storage.objects;
create policy "registration_proofs_update_own_or_admin"
on storage.objects for update
to authenticated
using (
  bucket_id = 'registration-payment-proofs'
  and (public.is_admin() or owner = auth.uid())
)
with check (
  bucket_id = 'registration-payment-proofs'
  and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
);

drop policy if exists "registration_proofs_delete_own_or_admin" on storage.objects;
create policy "registration_proofs_delete_own_or_admin"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'registration-payment-proofs'
  and (public.is_admin() or owner = auth.uid())
);

drop policy if exists "merch_proofs_read_own_or_admin" on storage.objects;
create policy "merch_proofs_read_own_or_admin"
on storage.objects for select
to authenticated
using (
  bucket_id = 'merch-payment-proofs'
  and (
    public.is_admin()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

drop policy if exists "merch_proofs_insert_own" on storage.objects;
create policy "merch_proofs_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'merch-payment-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "merch_proofs_update_own_or_admin" on storage.objects;
create policy "merch_proofs_update_own_or_admin"
on storage.objects for update
to authenticated
using (
  bucket_id = 'merch-payment-proofs'
  and (public.is_admin() or owner = auth.uid())
)
with check (
  bucket_id = 'merch-payment-proofs'
  and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
);

drop policy if exists "merch_proofs_delete_own_or_admin" on storage.objects;
create policy "merch_proofs_delete_own_or_admin"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'merch-payment-proofs'
  and (public.is_admin() or owner = auth.uid())
);

-- ============================================================
-- Types
-- ============================================================

do $$ begin
  create type public.form_submission_status as enum ('Draft', 'Submitted', 'Cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.form_payment_status as enum ('Pending', 'Partial', 'Paid', 'Verified', 'Rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.merch_type as enum ('Shirt', 'Lace', 'Others');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.shirt_size as enum ('XS', 'S', 'M', 'L', 'XL', 'XXL');
exception when duplicate_object then null;
end $$;

-- ============================================================
-- Event pre-registration configuration
-- ============================================================

alter table public.events
  add column if not exists pre_registration_enabled boolean not null default false,
  add column if not exists pre_registration_slug text,
  add column if not exists registration_fee numeric(12,2) not null default 0,
  add column if not exists registration_deadline timestamptz,
  add column if not exists registration_guide text not null default 'Registration must be filled out by one representative only, preferably the Local Church President.',
  add column if not exists registration_form_config jsonb not null default '{}'::jsonb,
  add column if not exists registration_gcash_details text,
  add column if not exists registration_gcash_recipient_name text,
  add column if not exists registration_gcash_number text;

create unique index if not exists events_pre_registration_slug_unique
on public.events (lower(pre_registration_slug))
where pre_registration_slug is not null;

do $$ begin
  alter table public.events
    add constraint events_registration_fee_nonnegative check (registration_fee >= 0);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.events
    add constraint events_registration_config_object
    check (jsonb_typeof(registration_form_config) = 'object');
exception when duplicate_object then null;
end $$;

comment on column public.events.pre_registration_enabled is 'Admin Open Pre-Registration switch.';
comment on column public.events.registration_form_config is 'Optional UI configuration for custom sections, labels, help text, and required fields.';
comment on column public.events.registration_gcash_recipient_name is 'Recipient name displayed in event registration payment instructions.';
comment on column public.events.registration_gcash_number is 'GCash number displayed in event registration payment instructions.';

-- ============================================================
-- Event registrations and delegates
-- ============================================================

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  local_church_id uuid not null references public.local_churches(id) on delete restrict,
  local_church_worker text not null,
  worker_contact_number text not null,
  local_church_president text not null,
  president_contact_number text not null,
  male_delegate_count integer not null default 0 check (male_delegate_count >= 0),
  female_delegate_count integer not null default 0 check (female_delegate_count >= 0),
  total_delegate_count integer generated always as (male_delegate_count + female_delegate_count) stored,
  fee_per_delegate numeric(12,2) not null check (fee_per_delegate >= 0),
  expected_total numeric(12,2) generated always as (
    (male_delegate_count + female_delegate_count) * fee_per_delegate
  ) stored,
  gcash_mode_of_payment text,
  payment_sender_name text,
  proof_of_payment_url text,
  payment_date date,
  reference_number text,
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  payment_shortfall numeric(12,2) not null default 0 check (payment_shortfall >= 0),
  payment_status public.form_payment_status not null default 'Pending',
  submission_status public.form_submission_status not null default 'Draft',
  submitted_at timestamptz,
  admin_notes text,
  custom_field_responses jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_registrations_event_church_unique unique (event_id, local_church_id),
  constraint event_registration_submission_time_check check (
    (submission_status = 'Submitted' and submitted_at is not null)
    or submission_status <> 'Submitted'
  )
);

alter table public.event_registrations
  add column if not exists payment_sender_name text,
  add column if not exists custom_field_responses jsonb not null default '{}'::jsonb,
  add column if not exists payment_shortfall numeric(12,2) not null default 0 check (payment_shortfall >= 0);

create table if not exists public.event_registration_delegates (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.event_registrations(id) on delete cascade,
  selected_member_id uuid references public.local_church_members(id) on delete set null,
  row_number integer not null check (row_number > 0),
  name text not null,
  age integer not null check (age between 0 and 120),
  gender public.gender_type not null,
  health_condition text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_delegate_gender_check check (gender in ('Male', 'Female')),
  constraint event_delegate_row_unique unique (registration_id, row_number),
  constraint event_delegate_member_unique unique (registration_id, selected_member_id)
);

create index if not exists event_registrations_event_idx on public.event_registrations(event_id);
create index if not exists event_registrations_user_idx on public.event_registrations(submitted_by);
create index if not exists event_registrations_church_idx on public.event_registrations(local_church_id);
create index if not exists event_registration_delegates_registration_idx on public.event_registration_delegates(registration_id);

drop trigger if exists set_event_registrations_updated_at on public.event_registrations;
create trigger set_event_registrations_updated_at
before update on public.event_registrations
for each row execute function public.set_updated_at();

drop trigger if exists set_event_registration_delegates_updated_at on public.event_registration_delegates;
create trigger set_event_registration_delegates_updated_at
before update on public.event_registration_delegates
for each row execute function public.set_updated_at();

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
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into event_record from public.events where id = new.event_id;
  if event_record.id is null then
    raise exception 'Event not found';
  end if;

  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.submitted_by := auth.uid();
    end if;
    new.fee_per_delegate := event_record.registration_fee;
  else
    new.event_id := old.event_id;
    new.submitted_by := old.submitted_by;
    new.local_church_id := old.local_church_id;
    new.fee_per_delegate := old.fee_per_delegate;

    if not public.is_admin() and old.submission_status <> 'Draft' then
      raise exception 'Only draft registrations can be edited';
    end if;
  end if;

  if not public.is_admin() then
    if event_record.status <> 'Published' or not event_record.pre_registration_enabled then
      raise exception 'Pre-registration is not open for this event';
    end if;
    if event_record.registration_deadline is not null and now() > event_record.registration_deadline then
      raise exception 'The pre-registration deadline has passed';
    end if;
    new.payment_status := case
      when new.amount_paid >= ((new.male_delegate_count + new.female_delegate_count) * new.fee_per_delegate)
        and new.amount_paid > 0 then 'Paid'::public.form_payment_status
      when new.amount_paid > 0 then 'Partial'::public.form_payment_status
      else 'Pending'::public.form_payment_status
    end;
    if tg_op = 'UPDATE' then
      new.admin_notes := old.admin_notes;
    else
      new.admin_notes := null;
    end if;
  end if;

  if new.submission_status = 'Submitted' then
    if tg_op = 'INSERT' then
      raise exception 'Create the draft and delegate rows before submitting the registration';
    end if;

    select
      count(*),
      count(*) filter (where gender = 'Male'),
      count(*) filter (where gender = 'Female')
    into delegate_rows, male_rows, female_rows
    from public.event_registration_delegates
    where registration_id = old.id;

    if delegate_rows <= 0 then
      raise exception 'At least one delegate must be added before submitting';
    end if;

    -- The delegate table is the source of truth. Counts are derived from each
    -- row's Male/Female selection instead of trusting manually entered totals.
    new.male_delegate_count := male_rows;
    new.female_delegate_count := female_rows;
    new.submitted_at := coalesce(old.submitted_at, now());
  elsif new.submission_status = 'Draft' then
    new.submitted_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists prepare_event_registration_trigger on public.event_registrations;
create trigger prepare_event_registration_trigger
before insert or update on public.event_registrations
for each row execute function public.prepare_event_registration();

create or replace function public.validate_event_registration_delegate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  registration_record public.event_registrations;
  member_record public.local_church_members;
begin
  select * into registration_record
  from public.event_registrations
  where id = new.registration_id;

  if registration_record.id is null then
    raise exception 'Registration not found';
  end if;
  if registration_record.submission_status <> 'Draft' and not public.is_admin() then
    raise exception 'Delegates can only be changed while the registration is a draft';
  end if;

  if new.selected_member_id is not null then
    select * into member_record
    from public.local_church_members
    where id = new.selected_member_id;

    if member_record.id is null
      or member_record.local_church_id <> registration_record.local_church_id
      or member_record.review_status <> 'Approved'
    then
      raise exception 'Selected member must be approved and belong to the registration church';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_event_registration_delegate_trigger on public.event_registration_delegates;
create trigger validate_event_registration_delegate_trigger
before insert or update on public.event_registration_delegates
for each row execute function public.validate_event_registration_delegate();

-- Returns only the fields needed by the delegate picker. This avoids exposing
-- private member details while allowing a representative to find approved,
-- active members from their own local church.
create or replace function public.list_my_church_members()
returns table (
  id uuid,
  local_church_id uuid,
  name text,
  birthday date,
  gender public.gender_type
)
language sql
stable
security definer
set search_path = public
as $$
  select member.id, member.local_church_id, member.name, member.birthday, member.gender
  from public.local_church_members member
  where member.review_status = 'Approved'
    and member.activity_status = 'Active'
    and (
      public.is_admin()
      or member.local_church_id in (
        select mine.local_church_id
        from public.local_church_members mine
        where mine.submitted_by = auth.uid()
          and mine.review_status = 'Approved'
      )
    )
  order by member.name;
$$;

revoke all on function public.list_my_church_members() from public;
grant execute on function public.list_my_church_members() to authenticated;

-- ============================================================
-- Merch pre-order forms, orders, and shirt variants
-- ============================================================

create table if not exists public.merch_preorder_forms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  preorder_date date not null,
  deadline timestamptz,
  image_url text,
  merch_type public.merch_type not null,
  custom_merch_name text,
  item_fee numeric(12,2) not null check (item_fee >= 0),
  slug text not null,
  status public.event_status not null default 'Draft',
  guide_text text not null default 'Pre-order must be filled out by one representative only, preferably the Local Church President.',
  gcash_details text,
  gcash_recipient_name text,
  gcash_number text,
  form_config jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merch_custom_name_check check (
    (merch_type = 'Others' and nullif(trim(custom_merch_name), '') is not null)
    or merch_type <> 'Others'
  ),
  constraint merch_form_config_object check (jsonb_typeof(form_config) = 'object')
);

alter table public.merch_preorder_forms
  add column if not exists gcash_recipient_name text,
  add column if not exists gcash_number text;

create unique index if not exists merch_preorder_forms_slug_unique
on public.merch_preorder_forms(lower(slug));

create table if not exists public.merch_preorders (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.merch_preorder_forms(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  local_church_id uuid not null references public.local_churches(id) on delete restrict,
  local_church_president text not null,
  president_contact_number text not null,
  total_quantity integer not null default 0 check (total_quantity >= 0),
  fee_per_item numeric(12,2) not null check (fee_per_item >= 0),
  expected_total numeric(12,2) generated always as (total_quantity * fee_per_item) stored,
  gcash_mode_of_payment text,
  payment_sender_name text,
  proof_of_payment_url text,
  payment_date date,
  reference_number text,
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  payment_shortfall numeric(12,2) not null default 0 check (payment_shortfall >= 0),
  payment_status public.form_payment_status not null default 'Pending',
  submission_status public.form_submission_status not null default 'Draft',
  submitted_at timestamptz,
  admin_notes text,
  custom_field_responses jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merch_preorders_form_church_unique unique(form_id, local_church_id),
  constraint merch_preorder_submission_time_check check (
    (submission_status = 'Submitted' and submitted_at is not null)
    or submission_status <> 'Submitted'
  )
);

alter table public.merch_preorders
  add column if not exists payment_sender_name text,
  add column if not exists custom_field_responses jsonb not null default '{}'::jsonb,
  add column if not exists payment_shortfall numeric(12,2) not null default 0 check (payment_shortfall >= 0);

create table if not exists public.merch_shirt_order_items (
  id uuid primary key default gen_random_uuid(),
  preorder_id uuid not null references public.merch_preorders(id) on delete cascade,
  color text not null check (nullif(trim(color), '') is not null),
  size public.shirt_size not null,
  quantity integer not null default 0 check (quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merch_shirt_variant_unique unique(preorder_id, color, size)
);

create index if not exists merch_preorders_form_idx on public.merch_preorders(form_id);
create index if not exists merch_preorders_user_idx on public.merch_preorders(submitted_by);
create index if not exists merch_preorders_church_idx on public.merch_preorders(local_church_id);
create index if not exists merch_shirt_items_preorder_idx on public.merch_shirt_order_items(preorder_id);

drop trigger if exists set_merch_preorder_forms_updated_at on public.merch_preorder_forms;
create trigger set_merch_preorder_forms_updated_at
before update on public.merch_preorder_forms
for each row execute function public.set_updated_at();

drop trigger if exists set_merch_preorders_updated_at on public.merch_preorders;
create trigger set_merch_preorders_updated_at
before update on public.merch_preorders
for each row execute function public.set_updated_at();

drop trigger if exists set_merch_shirt_order_items_updated_at on public.merch_shirt_order_items;
create trigger set_merch_shirt_order_items_updated_at
before update on public.merch_shirt_order_items
for each row execute function public.set_updated_at();

create or replace function public.prepare_merch_preorder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  form_record public.merch_preorder_forms;
  shirt_total integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into form_record from public.merch_preorder_forms where id = new.form_id;
  if form_record.id is null then
    raise exception 'Merch pre-order form not found';
  end if;

  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.submitted_by := auth.uid();
    end if;
    new.fee_per_item := form_record.item_fee;
    if form_record.merch_type = 'Shirt' then
      new.total_quantity := 0;
    end if;
  else
    new.form_id := old.form_id;
    new.submitted_by := old.submitted_by;
    new.local_church_id := old.local_church_id;
    new.fee_per_item := old.fee_per_item;

    if not public.is_admin() and old.submission_status <> 'Draft' then
      raise exception 'Only draft pre-orders can be edited';
    end if;
  end if;

  if not public.is_admin() then
    if form_record.status <> 'Published' then
      raise exception 'This merch pre-order form is not open';
    end if;
    if form_record.deadline is not null and now() > form_record.deadline then
      raise exception 'The merch pre-order deadline has passed';
    end if;
    new.payment_status := case
      when new.amount_paid >= (new.total_quantity * new.fee_per_item)
        and new.amount_paid > 0 then 'Paid'::public.form_payment_status
      when new.amount_paid > 0 then 'Partial'::public.form_payment_status
      else 'Pending'::public.form_payment_status
    end;
    if tg_op = 'UPDATE' then
      new.admin_notes := old.admin_notes;
    else
      new.admin_notes := null;
    end if;
  end if;

  if new.submission_status = 'Submitted' then
    if tg_op = 'INSERT' then
      raise exception 'Create the draft and order details before submitting the pre-order';
    end if;

    if form_record.merch_type = 'Shirt' then
      select coalesce(sum(quantity), 0)::integer into shirt_total
      from public.merch_shirt_order_items
      where preorder_id = old.id;
      new.total_quantity := shirt_total;
    end if;

    if new.total_quantity <= 0 then
      raise exception 'At least one item must be ordered';
    end if;
    new.submitted_at := coalesce(old.submitted_at, now());
  elsif new.submission_status = 'Draft' then
    new.submitted_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists prepare_merch_preorder_trigger on public.merch_preorders;
create trigger prepare_merch_preorder_trigger
before insert or update on public.merch_preorders
for each row execute function public.prepare_merch_preorder();

create or replace function public.sync_shirt_preorder_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_preorder_id uuid;
  order_record public.merch_preorders;
  form_kind public.merch_type;
begin
  if tg_op = 'DELETE' then
    target_preorder_id := old.preorder_id;
  else
    target_preorder_id := new.preorder_id;
  end if;

  select preorder.*
  into order_record
  from public.merch_preorders preorder
  where preorder.id = target_preorder_id;

  select form.merch_type
  into form_kind
  from public.merch_preorder_forms form
  where form.id = order_record.form_id;

  if order_record.id is null then
    raise exception 'Pre-order not found';
  end if;
  if form_kind <> 'Shirt' then
    raise exception 'Size and color rows are only valid for shirt pre-orders';
  end if;
  if order_record.submission_status <> 'Draft' and not public.is_admin() then
    raise exception 'Shirt order details can only be changed while the pre-order is a draft';
  end if;

  update public.merch_preorders
  set total_quantity = (
    select coalesce(sum(quantity), 0)::integer
    from public.merch_shirt_order_items
    where preorder_id = target_preorder_id
  )
  where id = target_preorder_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_shirt_preorder_total_trigger on public.merch_shirt_order_items;
create trigger sync_shirt_preorder_total_trigger
after insert or update or delete on public.merch_shirt_order_items
for each row execute function public.sync_shirt_preorder_total();

-- Payment proof does not prove the amount. User submissions always enter the
-- admin review queue as Pending. Only admins can verify full/partial payment.
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

-- ============================================================
-- Row-level security
-- ============================================================

alter table public.event_registrations enable row level security;
alter table public.event_registration_delegates enable row level security;
alter table public.merch_preorder_forms enable row level security;
alter table public.merch_preorders enable row level security;
alter table public.merch_shirt_order_items enable row level security;

drop policy if exists "event_registrations_select_own_or_admin" on public.event_registrations;
create policy "event_registrations_select_own_or_admin"
on public.event_registrations for select
to authenticated
using (submitted_by = auth.uid() or public.is_admin());

drop policy if exists "event_registrations_insert_own" on public.event_registrations;
create policy "event_registrations_insert_own"
on public.event_registrations for insert
to authenticated
with check (submitted_by = auth.uid() or public.is_admin());

drop policy if exists "event_registrations_update_own_draft_or_admin" on public.event_registrations;
create policy "event_registrations_update_own_draft_or_admin"
on public.event_registrations for update
to authenticated
using ((submitted_by = auth.uid() and submission_status = 'Draft') or public.is_admin())
with check (submitted_by = auth.uid() or public.is_admin());

drop policy if exists "event_registrations_delete_own_draft_or_admin" on public.event_registrations;
create policy "event_registrations_delete_own_draft_or_admin"
on public.event_registrations for delete
to authenticated
using ((submitted_by = auth.uid() and submission_status = 'Draft') or public.is_admin());

drop policy if exists "event_delegates_select_own_or_admin" on public.event_registration_delegates;
create policy "event_delegates_select_own_or_admin"
on public.event_registration_delegates for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.event_registrations registration
    where registration.id = registration_id and registration.submitted_by = auth.uid()
  )
);

drop policy if exists "event_delegates_insert_own_draft_or_admin" on public.event_registration_delegates;
create policy "event_delegates_insert_own_draft_or_admin"
on public.event_registration_delegates for insert
to authenticated
with check (
  public.is_admin()
  or exists (
    select 1 from public.event_registrations registration
    where registration.id = registration_id
      and registration.submitted_by = auth.uid()
      and registration.submission_status = 'Draft'
  )
);

drop policy if exists "event_delegates_update_own_draft_or_admin" on public.event_registration_delegates;
create policy "event_delegates_update_own_draft_or_admin"
on public.event_registration_delegates for update
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.event_registrations registration
    where registration.id = registration_id
      and registration.submitted_by = auth.uid()
      and registration.submission_status = 'Draft'
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.event_registrations registration
    where registration.id = registration_id
      and registration.submitted_by = auth.uid()
      and registration.submission_status = 'Draft'
  )
);

drop policy if exists "event_delegates_delete_own_draft_or_admin" on public.event_registration_delegates;
create policy "event_delegates_delete_own_draft_or_admin"
on public.event_registration_delegates for delete
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.event_registrations registration
    where registration.id = registration_id
      and registration.submitted_by = auth.uid()
      and registration.submission_status = 'Draft'
  )
);

drop policy if exists "merch_forms_select_published_or_admin" on public.merch_preorder_forms;
create policy "merch_forms_select_published_or_admin"
on public.merch_preorder_forms for select
to public
using (status = 'Published' or public.is_admin());

drop policy if exists "merch_forms_admin_manage" on public.merch_preorder_forms;
create policy "merch_forms_admin_manage"
on public.merch_preorder_forms for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "merch_preorders_select_own_or_admin" on public.merch_preorders;
create policy "merch_preorders_select_own_or_admin"
on public.merch_preorders for select
to authenticated
using (submitted_by = auth.uid() or public.is_admin());

drop policy if exists "merch_preorders_insert_own" on public.merch_preorders;
create policy "merch_preorders_insert_own"
on public.merch_preorders for insert
to authenticated
with check (submitted_by = auth.uid() or public.is_admin());

drop policy if exists "merch_preorders_update_own_draft_or_admin" on public.merch_preorders;
create policy "merch_preorders_update_own_draft_or_admin"
on public.merch_preorders for update
to authenticated
using ((submitted_by = auth.uid() and submission_status = 'Draft') or public.is_admin())
with check (submitted_by = auth.uid() or public.is_admin());

drop policy if exists "merch_preorders_delete_own_draft_or_admin" on public.merch_preorders;
create policy "merch_preorders_delete_own_draft_or_admin"
on public.merch_preorders for delete
to authenticated
using ((submitted_by = auth.uid() and submission_status = 'Draft') or public.is_admin());

drop policy if exists "shirt_items_select_own_or_admin" on public.merch_shirt_order_items;
create policy "shirt_items_select_own_or_admin"
on public.merch_shirt_order_items for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.merch_preorders preorder
    where preorder.id = preorder_id and preorder.submitted_by = auth.uid()
  )
);

drop policy if exists "shirt_items_insert_own_draft_or_admin" on public.merch_shirt_order_items;
create policy "shirt_items_insert_own_draft_or_admin"
on public.merch_shirt_order_items for insert
to authenticated
with check (
  public.is_admin()
  or exists (
    select 1 from public.merch_preorders preorder
    where preorder.id = preorder_id
      and preorder.submitted_by = auth.uid()
      and preorder.submission_status = 'Draft'
  )
);

drop policy if exists "shirt_items_update_own_draft_or_admin" on public.merch_shirt_order_items;
create policy "shirt_items_update_own_draft_or_admin"
on public.merch_shirt_order_items for update
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.merch_preorders preorder
    where preorder.id = preorder_id
      and preorder.submitted_by = auth.uid()
      and preorder.submission_status = 'Draft'
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.merch_preorders preorder
    where preorder.id = preorder_id
      and preorder.submitted_by = auth.uid()
      and preorder.submission_status = 'Draft'
  )
);

drop policy if exists "shirt_items_delete_own_draft_or_admin" on public.merch_shirt_order_items;
create policy "shirt_items_delete_own_draft_or_admin"
on public.merch_shirt_order_items for delete
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.merch_preorders preorder
    where preorder.id = preorder_id
      and preorder.submitted_by = auth.uid()
      and preorder.submission_status = 'Draft'
  )
);

-- ============================================================
-- Admin analytics views (RLS remains enforced for the caller)
-- ============================================================

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

create or replace view public.merch_shirt_variant_analytics
with (security_invoker = true)
as
select
  preorder.form_id,
  item.color,
  item.size,
  sum(item.quantity)::bigint as total_quantity
from public.merch_shirt_order_items item
join public.merch_preorders preorder on preorder.id = item.preorder_id
where preorder.submission_status = 'Submitted'
group by preorder.form_id, item.color, item.size;

comment on view public.event_registration_analytics is 'Admin dashboard totals per event; event registration RLS restricts rows.';
comment on view public.merch_preorder_analytics is 'Admin dashboard totals per merch form; pre-order RLS restricts rows.';
comment on view public.merch_shirt_variant_analytics is 'Submitted shirt quantities grouped by form, color, and size.';
