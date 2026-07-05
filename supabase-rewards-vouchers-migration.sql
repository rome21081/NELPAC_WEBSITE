-- Expanded One Card rewards, claim details, registration discount vouchers,
-- and approved merch-reward allocations.
alter table public.rewards
  add column if not exists reward_type text not null default 'Others',
  add column if not exists custom_type text,
  add column if not exists merch_form_id uuid references public.merch_preorder_forms(id) on delete set null,
  add column if not exists available_sizes text[] not null default '{}'::text[],
  add column if not exists discount_percentage integer,
  add column if not exists discount_event_id uuid references public.events(id) on delete set null,
  add column if not exists discount_registration_types text[] not null default '{}'::text[];

do $$ begin
  alter table public.rewards add constraint rewards_type_check
    check (reward_type in ('Shirt', 'ID Lace', 'Discount', 'Others'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.rewards add constraint rewards_discount_percentage_check
    check (discount_percentage is null or discount_percentage between 10 and 100);
exception when duplicate_object then null; end $$;

alter table public.reward_claims
  add column if not exists claimant_name text,
  add column if not exists district text,
  add column if not exists local_church_id uuid references public.local_churches(id) on delete set null,
  add column if not exists local_church_name text,
  add column if not exists selected_size text;

-- Physical reward collection codes do not expire. They remain valid until an
-- admin marks the approved item as claimed. Expiration is exclusive to
-- registration discount vouchers.
alter table public.redeem_codes
  alter column expires_at drop not null;
update public.redeem_codes collection_code
set expires_at = null
from public.reward_claims claim
join public.rewards reward on reward.id = claim.reward_id
where collection_code.claim_id = claim.id
  and reward.reward_type <> 'Discount';

create table if not exists public.registration_discount_vouchers (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null unique references public.reward_claims(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  code text not null unique,
  discount_percentage integer not null check (discount_percentage between 10 and 100),
  allowed_registration_types text[] not null,
  is_used boolean not null default false,
  used_registration_id uuid references public.event_registrations(id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint registration_discount_voucher_used_check check (
    (not is_used and used_registration_id is null and used_at is null)
    or (is_used and used_registration_id is not null and used_at is not null)
  )
);

create table if not exists public.reward_merch_allocations (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null unique references public.reward_claims(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_church_id uuid references public.local_churches(id) on delete set null,
  merch_form_id uuid references public.merch_preorder_forms(id) on delete set null,
  reward_id uuid not null references public.rewards(id) on delete restrict,
  reward_name text not null,
  reward_type text not null,
  selected_size text,
  quantity integer not null default 1 check (quantity = 1),
  source text not null default 'Claim Reward',
  created_at timestamptz not null default now()
);

alter table public.event_registrations
  add column if not exists voucher_code text,
  add column if not exists voucher_discount_percentage integer,
  add column if not exists voucher_discount_amount numeric(12,2) not null default 0,
  add column if not exists final_expected_total numeric(12,2) not null default 0;

-- The SQL Editor has no auth.uid(), while the existing registration trigger
-- requires an authenticated user. Pause user triggers only for this one-time
-- data backfill. Legacy rows may also contain placeholder phone values, so
-- temporarily remove those checks and restore them as NOT VALID afterward.
alter table public.event_registrations disable trigger user;
alter table public.event_registrations
  drop constraint if exists event_worker_contact_ph_mobile_check,
  drop constraint if exists event_president_contact_ph_mobile_check;
update public.event_registrations
set final_expected_total = greatest(expected_total - coalesce(voucher_discount_amount, 0), 0)
where final_expected_total = 0 and expected_total > 0;
alter table public.event_registrations
  add constraint event_worker_contact_ph_mobile_check
    check (worker_contact_number ~ '^09[0-9]{9}$') not valid,
  add constraint event_president_contact_ph_mobile_check
    check (president_contact_number ~ '^09[0-9]{9}$') not valid;
alter table public.event_registrations enable trigger user;

drop function if exists public.submit_reward_claim(uuid);
drop function if exists public.submit_reward_claim(uuid, text);
create function public.submit_reward_claim(
  p_reward_id uuid,
  p_selected_size text default null
)
returns public.reward_claims
language plpgsql security definer set search_path = public
as $$
declare
  reward_record public.rewards;
  profile_record public.profiles;
  church_record public.local_churches;
  current_balance integer;
  new_claim public.reward_claims;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into reward_record from public.rewards where id = p_reward_id and is_active = true;
  if reward_record.id is null then raise exception 'Reward is not available'; end if;
  if reward_record.stock_quantity <= 0 then raise exception 'Reward is out of stock'; end if;
  if reward_record.reward_type = 'Shirt' and (
    p_selected_size is null or not (p_selected_size = any(reward_record.available_sizes))
  ) then raise exception 'Select an available shirt size'; end if;
  select * into profile_record from public.profiles where id = auth.uid();
  select * into church_record from public.local_churches where id = profile_record.local_church_id;
  select coalesce(sum(points), 0)::integer into current_balance
    from public.one_card_points where user_id = auth.uid();
  if current_balance < reward_record.required_points then raise exception 'Insufficient points'; end if;

  insert into public.reward_claims (
    user_id, reward_id, points_used, claimant_name, district,
    local_church_id, local_church_name, selected_size
  ) values (
    auth.uid(), reward_record.id, reward_record.required_points,
    coalesce(nullif(trim(profile_record.full_name), ''), nullif(trim(profile_record.name), ''), 'No name provided'),
    church_record.district::text, church_record.id, church_record.name,
    nullif(trim(p_selected_size), '')
  ) returning * into new_claim;
  insert into public.notifications (user_id, title, message, type)
    values (auth.uid(), 'Reward claim submitted', 'Your claim for ' || reward_record.name || ' is pending admin review.', 'reward_claim');
  return new_claim;
end;
$$;

create or replace function public.admin_review_reward_claim(
  p_claim_id uuid,
  p_new_status public.reward_claim_status,
  p_admin_notes text default null,
  p_code_expires_at timestamptz default now() + interval '30 days'
)
returns public.reward_claims
language plpgsql security definer set search_path = public
as $$
declare
  old_claim public.reward_claims;
  reward_record public.rewards;
  current_balance integer;
  generated_code text;
  updated_claim public.reward_claims;
begin
  if not public.is_admin() then raise exception 'Only admins can review reward claims'; end if;
  if p_new_status not in ('Approved', 'Rejected') then raise exception 'Use Approved or Rejected for admin review'; end if;
  select * into old_claim from public.reward_claims where id = p_claim_id for update;
  if old_claim.id is null then raise exception 'Reward claim not found'; end if;
  if old_claim.claim_status <> 'Pending' then raise exception 'Only pending reward claims can be reviewed'; end if;
  select * into reward_record from public.rewards where id = old_claim.reward_id for update;

  if p_new_status = 'Approved' then
    if reward_record.stock_quantity <= 0 then raise exception 'Reward is out of stock'; end if;
    select coalesce(sum(points), 0)::integer into current_balance from public.one_card_points where user_id = old_claim.user_id;
    if current_balance < old_claim.points_used then raise exception 'User has insufficient points'; end if;
    update public.rewards set stock_quantity = stock_quantity - 1 where id = old_claim.reward_id;
    insert into public.one_card_points (user_id, entry_type, points, description, created_by)
      values (old_claim.user_id, 'redeemed', -old_claim.points_used, 'Reward redeemed: ' || reward_record.name, auth.uid());
  end if;

  update public.reward_claims set claim_status = p_new_status, admin_notes = p_admin_notes,
    reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_claim_id returning * into updated_claim;

  if p_new_status = 'Approved' then
    loop
      generated_code := upper(substr(md5(random()::text || clock_timestamp()::text || p_claim_id::text), 1, 12));
      exit when not exists (select 1 from public.redeem_codes where code = generated_code)
        and not exists (select 1 from public.registration_discount_vouchers where code = generated_code);
    end loop;
    if reward_record.reward_type = 'Discount' then
      insert into public.registration_discount_vouchers (
        claim_id, user_id, event_id, code, discount_percentage,
        allowed_registration_types, expires_at
      ) values (
        p_claim_id, old_claim.user_id, reward_record.discount_event_id,
        generated_code, reward_record.discount_percentage,
        reward_record.discount_registration_types, p_code_expires_at
      );
    else
      insert into public.redeem_codes (claim_id, user_id, code)
        values (p_claim_id, old_claim.user_id, generated_code);
      if reward_record.reward_type in ('Shirt', 'ID Lace') or reward_record.merch_form_id is not null then
        insert into public.reward_merch_allocations (
          claim_id, user_id, local_church_id, merch_form_id, reward_id,
          reward_name, reward_type, selected_size
        ) values (
          p_claim_id, old_claim.user_id, old_claim.local_church_id,
          reward_record.merch_form_id, reward_record.id, reward_record.name,
          reward_record.reward_type, old_claim.selected_size
        );
      end if;
    end if;
    perform public.create_notification(old_claim.user_id, 'Reward claim approved',
      case when reward_record.reward_type = 'Discount'
        then 'Your discount voucher is ready for event registration.'
        else 'Your reward claim was approved. A collection code has been generated.' end,
      'reward_claim');
  else
    perform public.create_notification(old_claim.user_id, 'Reward claim rejected', coalesce(p_admin_notes, 'Your reward claim was rejected by an admin.'), 'reward_claim');
  end if;
  perform public.record_audit_log('review_reward_claim', 'reward_claims', p_claim_id, to_jsonb(old_claim), to_jsonb(updated_claim));
  return updated_claim;
end;
$$;

create or replace function public.validate_registration_discount_voucher(
  p_code text,
  p_event_id uuid,
  p_registration_type text
)
returns table (code text, discount_percentage integer)
language plpgsql security definer set search_path = public
as $$
declare voucher public.registration_discount_vouchers;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select discount_voucher.* into voucher
  from public.registration_discount_vouchers discount_voucher
  join public.reward_claims claim on claim.id = discount_voucher.claim_id
  join public.rewards reward on reward.id = claim.reward_id
  where upper(discount_voucher.code) = upper(trim(p_code))
    and discount_voucher.user_id = auth.uid()
    and reward.reward_type = 'Discount'
    and claim.claim_status = 'Approved';
  if voucher.id is null then raise exception 'INVALID_VOUCHER'; end if;
  if voucher.is_used then raise exception 'VOUCHER_ALREADY_USED'; end if;
  if voucher.expires_at is not null and voucher.expires_at < now() then raise exception 'INVALID_VOUCHER'; end if;
  if voucher.event_id <> p_event_id or not (p_registration_type = any(voucher.allowed_registration_types)) then
    raise exception 'INVALID_VOUCHER';
  end if;
  return query select voucher.code, voucher.discount_percentage;
end;
$$;

create or replace function public.apply_registration_discount_voucher()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  voucher public.registration_discount_vouchers;
  computed_original numeric(12,2);
begin
  computed_original := (new.male_delegate_count + new.female_delegate_count) * new.fee_per_delegate;
  new.voucher_discount_percentage := null;
  new.voucher_discount_amount := 0;
  new.final_expected_total := computed_original;
  if nullif(trim(new.voucher_code), '') is null then return new; end if;
  select discount_voucher.* into voucher
  from public.registration_discount_vouchers discount_voucher
  join public.reward_claims claim on claim.id = discount_voucher.claim_id
  join public.rewards reward on reward.id = claim.reward_id
  where upper(discount_voucher.code) = upper(trim(new.voucher_code))
    and discount_voucher.user_id = new.submitted_by
    and reward.reward_type = 'Discount'
    and claim.claim_status = 'Approved'
  for update of discount_voucher;
  if voucher.id is null then raise exception 'INVALID_VOUCHER'; end if;
  if voucher.is_used and voucher.used_registration_id is distinct from new.id then raise exception 'VOUCHER_ALREADY_USED'; end if;
  if voucher.expires_at is not null and voucher.expires_at < now() then raise exception 'INVALID_VOUCHER'; end if;
  if voucher.event_id <> new.event_id or not (new.registration_type = any(voucher.allowed_registration_types)) then raise exception 'INVALID_VOUCHER'; end if;
  new.voucher_code := voucher.code;
  new.voucher_discount_percentage := voucher.discount_percentage;
  -- Discount applies to one delegate fee only, per the product rule.
  new.voucher_discount_amount := round(new.fee_per_delegate * voucher.discount_percentage / 100.0, 2);
  new.final_expected_total := greatest(computed_original - new.voucher_discount_amount, 0);
  if new.submission_status = 'Submitted' and (tg_op = 'INSERT' or old.submission_status <> 'Submitted') then
    update public.registration_discount_vouchers set is_used = true,
      used_registration_id = new.id, used_at = now() where id = voucher.id;
  end if;
  return new;
end;
$$;

drop trigger if exists zy_apply_registration_discount_voucher on public.event_registrations;
create trigger zy_apply_registration_discount_voucher
before insert or update on public.event_registrations
for each row execute function public.apply_registration_discount_voucher();

-- Payment verification uses the discounted final total for registrations.
create or replace function public.enforce_payment_review_status()
returns trigger language plpgsql security definer set search_path = public
as $$
declare expected_amount numeric; row_data jsonb;
begin
  row_data := to_jsonb(new);
  if tg_table_name = 'event_registrations' then
    expected_amount := coalesce((row_data ->> 'final_expected_total')::numeric,
      (coalesce((row_data ->> 'male_delegate_count')::numeric, 0) + coalesce((row_data ->> 'female_delegate_count')::numeric, 0)) * coalesce((row_data ->> 'fee_per_delegate')::numeric, 0));
  else
    expected_amount := coalesce((row_data ->> 'total_quantity')::numeric, 0) * coalesce((row_data ->> 'fee_per_item')::numeric, 0);
  end if;
  if not public.is_admin() then
    new.payment_status := 'Pending'; new.payment_shortfall := 0; new.amount_paid := 0;
  elsif new.payment_status = 'Partial' then
    if new.payment_shortfall <= 0 or new.payment_shortfall >= expected_amount then raise exception 'Verified Partial requires a valid shortfall'; end if;
    new.amount_paid := expected_amount - new.payment_shortfall;
  elsif new.payment_status = 'Verified' then
    new.payment_shortfall := 0; new.amount_paid := expected_amount;
  else
    new.payment_shortfall := 0; new.amount_paid := 0;
  end if;
  return new;
end;
$$;

drop view if exists public.reward_claims_with_rewards;
create view public.reward_claims_with_rewards
with (security_invoker = true) as
select rc.*, r.name as reward_name, r.description as reward_description,
  r.image_url as reward_image_url, r.reward_type, r.custom_type,
  r.merch_form_id, r.discount_percentage, r.discount_event_id,
  coalesce(discount_code.code, collection_code.code) as voucher_code,
  case when discount_code.id is not null then 'Registration Discount' else 'Reward Collection' end as voucher_type,
  coalesce(discount_code.expires_at, collection_code.expires_at) as voucher_expires_at,
  coalesce(discount_code.is_used, collection_code.is_used, false) as voucher_used,
  coalesce(discount_code.used_at, collection_code.used_at) as voucher_used_at
from public.reward_claims rc
join public.rewards r on r.id = rc.reward_id
left join public.redeem_codes collection_code on collection_code.claim_id = rc.id
left join public.registration_discount_vouchers discount_code on discount_code.claim_id = rc.id;

alter table public.registration_discount_vouchers enable row level security;
alter table public.reward_merch_allocations enable row level security;
drop policy if exists "discount_vouchers_select_own_or_admin" on public.registration_discount_vouchers;
create policy "discount_vouchers_select_own_or_admin" on public.registration_discount_vouchers
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "discount_vouchers_admin_manage" on public.registration_discount_vouchers;
create policy "discount_vouchers_admin_manage" on public.registration_discount_vouchers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "reward_merch_allocations_admin_select" on public.reward_merch_allocations;
create policy "reward_merch_allocations_admin_select" on public.reward_merch_allocations
  for select to authenticated using (public.is_admin());
grant select on public.registration_discount_vouchers, public.reward_merch_allocations to authenticated;
grant select on public.reward_claims_with_rewards to authenticated;
