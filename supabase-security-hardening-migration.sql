-- NELPAC security hardening migration.
--
-- Purpose:
--   1. Tighten profile RLS.
--   2. Move payment transaction creation behind a trusted RPC.
--   3. Harden payment proof storage policies.
--   4. Add duplicate payment-reference detection when current data allows it.
--   5. Add automatic append-only audit logging for sensitive changes.
--   6. Preserve the current single-admin model using public.is_admin().
--
-- Run after:
--   supabase-schema.sql
--   supabase-event-registration-merch-schema.sql
--   supabase-form-supplements-migration.sql
--   supabase-gcash-payment-redirection-migration.sql
--   supabase-profile-church-phone-voucher-migration.sql
--
-- Pre-migration checks. Run these first and review the output:
--
-- 1) Profile rows missing for auth users:
-- select u.id, u.email, u.created_at
-- from auth.users u
-- left join public.profiles p on p.id = u.id
-- where p.id is null;
--
-- 2) Duplicate payment references that would block the unique index:
-- select provider, upper(trim(transaction_reference)) as normalized_reference, count(*) as duplicate_count,
--        array_agg(id order by created_at) as transaction_ids
-- from public.payment_transactions
-- where transaction_reference is not null and nullif(trim(transaction_reference), '') is not null
-- group by provider, upper(trim(transaction_reference))
-- having count(*) > 1;
--
-- 3) Payment proof paths outside trusted user folders:
-- select id, proof_bucket, proof_path, submitted_by
-- from public.payment_transactions
-- where proof_path is not null
--   and split_part(proof_path, '/', 1) is distinct from submitted_by::text;
--
-- 4) Existing unrestricted profile policies:
-- select policyname, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public' and tablename = 'profiles';

-- ============================================================
-- Profile RLS
-- ============================================================

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

comment on policy "profiles_select_own_or_admin" on public.profiles is
  'Normal users can read only their own complete profile; the existing admin role can read all profiles.';

-- Future enhancement: replace single-admin checks with scoped staff roles.

-- ============================================================
-- Google OAuth and missing-profile repair
-- ============================================================

create or replace function public.ensure_my_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  ensured_profile public.profiles;
  auth_user auth.users;
  metadata_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into auth_user
  from auth.users
  where id = auth.uid();

  if auth_user.id is null then
    raise exception 'Authenticated user not found';
  end if;

  metadata_name := coalesce(
    nullif(trim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(auth_user.raw_user_meta_data ->> 'name'), ''),
    ''
  );

  insert into public.profiles (
    id,
    full_name,
    name,
    name_completed,
    email,
    avatar_url,
    role
  )
  values (
    auth_user.id,
    metadata_name,
    metadata_name,
    false,
    auth_user.email,
    nullif(auth_user.raw_user_meta_data ->> 'avatar_url', ''),
    'user'
  )
  on conflict (id) do update
  set
    email = coalesce(public.profiles.email, excluded.email),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
    name = coalesce(nullif(public.profiles.name, ''), excluded.name)
  returning * into ensured_profile;

  return ensured_profile;
end;
$$;

revoke all on function public.ensure_my_profile() from public;
grant execute on function public.ensure_my_profile() to authenticated;

-- ============================================================
-- Payment reference normalization and duplicate detection
-- ============================================================

alter table public.payment_transactions
  add column if not exists normalized_transaction_reference text
  generated always as (
    nullif(upper(trim(transaction_reference)), '')
  ) stored;

create index if not exists payment_transactions_reference_lookup_idx
on public.payment_transactions(provider, normalized_transaction_reference)
where normalized_transaction_reference is not null;

create or replace view public.payment_transaction_reference_conflicts
with (security_invoker = true)
as
select
  provider,
  normalized_transaction_reference,
  count(*) as duplicate_count,
  array_agg(id order by created_at) as transaction_ids,
  min(created_at) as first_seen_at,
  max(created_at) as last_seen_at
from public.payment_transactions
where normalized_transaction_reference is not null
group by provider, normalized_transaction_reference
having count(*) > 1;

do $$
begin
  if not exists (
    select 1
    from public.payment_transactions
    where normalized_transaction_reference is not null
    group by provider, normalized_transaction_reference
    having count(*) > 1
  ) then
    create unique index if not exists payment_transactions_reference_unique
    on public.payment_transactions(provider, normalized_transaction_reference)
    where normalized_transaction_reference is not null;
  else
    raise notice 'Skipped payment_transactions_reference_unique because duplicate references exist. Review public.payment_transaction_reference_conflicts.';
  end if;
end $$;

-- ============================================================
-- Trusted payment RPC
-- ============================================================

drop function if exists public.submit_payment_transaction(text, text, uuid, numeric, text, text, date, text, text);

create or replace function public.submit_payment_transaction(
  p_module text,
  p_source_table text,
  p_source_id uuid,
  p_expected_amount numeric default null,
  p_payer_name text default null,
  p_transaction_reference text default null,
  p_payment_date date default null,
  p_proof_bucket text default null,
  p_proof_path text default null
)
returns public.payment_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  source_row jsonb;
  computed_amount numeric(12,2);
  expected_bucket text;
  expected_module text;
  saved_transaction public.payment_transactions;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_source_table not in (
    'event_registrations',
    'event_registration_supplements',
    'merch_preorders',
    'merch_preorder_supplements'
  ) then
    raise exception 'INVALID_PAYMENT_SOURCE';
  end if;

  if p_source_table = 'event_registrations' then
    select to_jsonb(r) into source_row
    from public.event_registrations r
    where r.id = p_source_id and r.submitted_by = auth.uid();
    expected_bucket := 'registration-payment-proofs';
    expected_module := coalesce(source_row ->> 'registration_type', 'Pre-Registration');
    expected_module := case when expected_module = 'Onsite' then 'onsite-registration' else 'event-registration' end;
    computed_amount := coalesce((source_row ->> 'final_expected_total')::numeric, (source_row ->> 'expected_total')::numeric, 0);
  elsif p_source_table = 'event_registration_supplements' then
    select to_jsonb(s) into source_row
    from public.event_registration_supplements s
    join public.event_registrations r on r.id = s.registration_id
    where s.id = p_source_id
      and s.submitted_by = auth.uid()
      and r.submitted_by = auth.uid();
    expected_bucket := 'registration-payment-proofs';
    select case when r.registration_type = 'Onsite' then 'onsite-registration' else 'event-registration' end
    into expected_module
    from public.event_registration_supplements s
    join public.event_registrations r on r.id = s.registration_id
    where s.id = p_source_id;
    computed_amount := coalesce((source_row ->> 'expected_total')::numeric, 0);
  elsif p_source_table = 'merch_preorders' then
    select to_jsonb(p) into source_row
    from public.merch_preorders p
    where p.id = p_source_id and p.submitted_by = auth.uid();
    expected_bucket := 'merch-payment-proofs';
    expected_module := 'merch-preorder';
    computed_amount := coalesce((source_row ->> 'expected_total')::numeric, 0);
  elsif p_source_table = 'merch_preorder_supplements' then
    select to_jsonb(s) into source_row
    from public.merch_preorder_supplements s
    join public.merch_preorders p on p.id = s.preorder_id
    where s.id = p_source_id
      and s.submitted_by = auth.uid()
      and p.submitted_by = auth.uid();
    expected_bucket := 'merch-payment-proofs';
    expected_module := 'merch-preorder';
    computed_amount := coalesce((source_row ->> 'expected_total')::numeric, 0);
  end if;

  if source_row is null then
    raise exception 'PAYMENT_SOURCE_NOT_FOUND_OR_NOT_OWNED';
  end if;

  if p_module is not null and p_module <> expected_module then
    raise exception 'INVALID_PAYMENT_MODULE';
  end if;

  if p_expected_amount is not null and round(p_expected_amount, 2) <> round(computed_amount, 2) then
    raise exception 'PAYMENT_AMOUNT_MISMATCH';
  end if;

  if p_proof_path is not null then
    if p_proof_bucket is distinct from expected_bucket then
      raise exception 'INVALID_PROOF_BUCKET';
    end if;
    if split_part(p_proof_path, '/', 1) <> auth.uid()::text then
      raise exception 'INVALID_PROOF_PATH';
    end if;
  end if;

  insert into public.payment_transactions (
    provider,
    module,
    source_table,
    source_id,
    submitted_by,
    amount,
    payer_name,
    transaction_reference,
    payment_date,
    proof_bucket,
    proof_path,
    status,
    gateway_payload
  )
  values (
    'manual-gcash',
    expected_module,
    p_source_table,
    p_source_id,
    auth.uid(),
    computed_amount,
    nullif(trim(p_payer_name), ''),
    nullif(upper(trim(p_transaction_reference)), ''),
    p_payment_date,
    expected_bucket,
    p_proof_path,
    'Pending',
    '{}'::jsonb
  )
  returning * into saved_transaction;

  return saved_transaction;
exception
  when unique_violation then
    raise exception 'DUPLICATE_PAYMENT_REFERENCE';
end;
$$;

revoke all on function public.submit_payment_transaction(text, text, uuid, numeric, text, text, date, text, text) from public;
grant execute on function public.submit_payment_transaction(text, text, uuid, numeric, text, text, date, text, text) to authenticated;

drop policy if exists "payment_transactions_insert_own" on public.payment_transactions;
drop policy if exists "payment_transactions_insert_admin" on public.payment_transactions;
create policy "payment_transactions_insert_admin"
on public.payment_transactions for insert
to authenticated
with check (public.is_admin());

comment on function public.submit_payment_transaction(text, text, uuid, numeric, text, text, date, text, text) is
  'Trusted payment creation RPC. Uses auth.uid(), validates source ownership, computes amount from database rows, and starts payments as Pending.';

-- ============================================================
-- Payment proof storage hardening
-- ============================================================

drop policy if exists "registration_proofs_update_own_or_admin" on storage.objects;
drop policy if exists "registration_proofs_delete_own_or_admin" on storage.objects;
drop policy if exists "registration_proofs_update_admin" on storage.objects;
drop policy if exists "registration_proofs_delete_admin" on storage.objects;

create policy "registration_proofs_update_admin"
on storage.objects for update
to authenticated
using (bucket_id = 'registration-payment-proofs' and public.is_admin())
with check (bucket_id = 'registration-payment-proofs' and public.is_admin());

create policy "registration_proofs_delete_admin"
on storage.objects for delete
to authenticated
using (bucket_id = 'registration-payment-proofs' and public.is_admin());

drop policy if exists "merch_proofs_update_own_or_admin" on storage.objects;
drop policy if exists "merch_proofs_delete_own_or_admin" on storage.objects;
drop policy if exists "merch_proofs_update_admin" on storage.objects;
drop policy if exists "merch_proofs_delete_admin" on storage.objects;

create policy "merch_proofs_update_admin"
on storage.objects for update
to authenticated
using (bucket_id = 'merch-payment-proofs' and public.is_admin())
with check (bucket_id = 'merch-payment-proofs' and public.is_admin());

create policy "merch_proofs_delete_admin"
on storage.objects for delete
to authenticated
using (bucket_id = 'merch-payment-proofs' and public.is_admin());

drop policy if exists "registration_proofs_insert_own" on storage.objects;
create policy "registration_proofs_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'registration-payment-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "merch_proofs_insert_own" on storage.objects;
create policy "merch_proofs_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'merch-payment-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- Automatic append-only audit logging
-- ============================================================

create or replace function public.write_internal_audit_log(
  p_action_type text,
  p_table_name text,
  p_record_id uuid,
  p_old_data jsonb default null,
  p_new_data jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (
    admin_user_id,
    action_type,
    table_name,
    record_id,
    old_data,
    new_data
  )
  values (
    auth.uid(),
    p_action_type,
    p_table_name,
    p_record_id,
    p_old_data,
    p_new_data
  );
end;
$$;

revoke all on function public.write_internal_audit_log(text, text, uuid, jsonb, jsonb) from public;

create or replace function public.audit_sensitive_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  record_uuid uuid;
begin
  if tg_op = 'INSERT' then
    record_uuid := new.id;
    perform public.write_internal_audit_log(
      'insert',
      tg_table_name,
      record_uuid,
      null,
      to_jsonb(new)
    );
    return new;
  elsif tg_op = 'UPDATE' then
    record_uuid := new.id;
    perform public.write_internal_audit_log(
      'update',
      tg_table_name,
      record_uuid,
      to_jsonb(old),
      to_jsonb(new)
    );
    return new;
  elsif tg_op = 'DELETE' then
    record_uuid := old.id;
    perform public.write_internal_audit_log(
      'delete',
      tg_table_name,
      record_uuid,
      to_jsonb(old),
      null
    );
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists audit_profile_sensitive_changes on public.profiles;
create trigger audit_profile_sensitive_changes
after update of role, local_church_id, contact_number, email on public.profiles
for each row
when (
  old.role is distinct from new.role
  or old.local_church_id is distinct from new.local_church_id
  or old.contact_number is distinct from new.contact_number
  or old.email is distinct from new.email
)
execute function public.audit_sensitive_change();

drop trigger if exists audit_event_registration_payment_changes on public.event_registrations;
create trigger audit_event_registration_payment_changes
after update of payment_status, amount_paid, payment_shortfall, payment_verified_by, payment_verified_at, admin_notes on public.event_registrations
for each row
when (
  old.payment_status is distinct from new.payment_status
  or old.amount_paid is distinct from new.amount_paid
  or old.payment_shortfall is distinct from new.payment_shortfall
  or old.payment_verified_by is distinct from new.payment_verified_by
  or old.payment_verified_at is distinct from new.payment_verified_at
  or old.admin_notes is distinct from new.admin_notes
)
execute function public.audit_sensitive_change();

drop trigger if exists audit_merch_preorder_payment_changes on public.merch_preorders;
create trigger audit_merch_preorder_payment_changes
after update of payment_status, amount_paid, payment_shortfall, payment_verified_by, payment_verified_at, admin_notes on public.merch_preorders
for each row
when (
  old.payment_status is distinct from new.payment_status
  or old.amount_paid is distinct from new.amount_paid
  or old.payment_shortfall is distinct from new.payment_shortfall
  or old.payment_verified_by is distinct from new.payment_verified_by
  or old.payment_verified_at is distinct from new.payment_verified_at
  or old.admin_notes is distinct from new.admin_notes
)
execute function public.audit_sensitive_change();

drop trigger if exists audit_payment_transactions_changes on public.payment_transactions;
create trigger audit_payment_transactions_changes
after insert or update or delete on public.payment_transactions
for each row execute function public.audit_sensitive_change();

drop trigger if exists audit_member_review_changes on public.local_church_members;
create trigger audit_member_review_changes
after update of review_status, reviewed_by, reviewed_at, admin_notes, local_church_id on public.local_church_members
for each row
when (
  old.review_status is distinct from new.review_status
  or old.reviewed_by is distinct from new.reviewed_by
  or old.reviewed_at is distinct from new.reviewed_at
  or old.admin_notes is distinct from new.admin_notes
  or old.local_church_id is distinct from new.local_church_id
)
execute function public.audit_sensitive_change();

drop policy if exists "audit_logs_insert_admin" on public.audit_logs;
drop policy if exists "audit_logs_update_admin" on public.audit_logs;
drop policy if exists "audit_logs_delete_admin" on public.audit_logs;

-- Audit logs are written by trusted security-definer functions/triggers.
-- No client insert/update/delete policy is intentionally defined.

-- ============================================================
-- Non-destructive validation and archive fields
-- ============================================================

do $$ begin
  alter table public.payment_transactions
    add constraint payment_transactions_reference_length_check
    check (transaction_reference is null or char_length(trim(transaction_reference)) between 4 and 80) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.payment_transactions
    add constraint payment_transactions_payer_name_length_check
    check (payer_name is null or char_length(trim(payer_name)) <= 120) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.profiles
    add constraint profiles_full_name_length_check
    check (char_length(full_name) <= 160) not valid;
exception when duplicate_object then null;
end $$;

alter table public.event_registrations
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

alter table public.merch_preorders
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

alter table public.payment_transactions
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

create index if not exists event_registrations_active_review_idx
on public.event_registrations(is_archived, payment_status, submitted_at);

create index if not exists merch_preorders_active_review_idx
on public.merch_preorders(is_archived, payment_status, submitted_at);

create index if not exists payment_transactions_active_review_idx
on public.payment_transactions(is_archived, status, created_at);

-- Verification queries:
-- select policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' and tablename = 'profiles';
-- select * from public.payment_transaction_reference_conflicts;
-- select proname from pg_proc where proname in ('ensure_my_profile', 'submit_payment_transaction');
-- select tgname, tgrelid::regclass from pg_trigger where tgname like 'audit_%' and not tgisinternal;
--
-- Rollback notes:
--   - Restore old profile select policy only if necessary.
--   - Drop public.submit_payment_transaction(...) to revert to direct inserts.
--   - Recreate payment_transactions_insert_own to allow direct frontend inserts.
--   - Drop payment_transactions_reference_unique if duplicate legacy references need temporary entry.
--   - Drop audit_* triggers if audit volume becomes a problem.
--   - Do not drop added archive columns; leave them unused for safe rollback.
