-- NELPAC duplicate-account consolidation.
--
-- IMPORTANT:
-- 1. Take a database backup before running this file.
-- 2. Run supabase-profile-church-phone-voucher-migration.sql first.
-- 3. Review duplicate contacts with the query at the bottom.
-- 4. Execute the final merge call only after reviewing its results.

create or replace function public.normalize_ph_mobile_contact(p_contact text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when regexp_replace(coalesce(p_contact, ''), '[^0-9]', '', 'g') ~ '^639[0-9]{9}$'
      then '0' || substr(regexp_replace(p_contact, '[^0-9]', '', 'g'), 3)
    when regexp_replace(coalesce(p_contact, ''), '[^0-9]', '', 'g') ~ '^9[0-9]{9}$'
      then '0' || regexp_replace(p_contact, '[^0-9]', '', 'g')
    when regexp_replace(coalesce(p_contact, ''), '[^0-9]', '', 'g') ~ '^09[0-9]{9}$'
      then regexp_replace(p_contact, '[^0-9]', '', 'g')
    else null
  end;
$$;

create table if not exists public.account_merge_audit (
  id uuid primary key default gen_random_uuid(),
  kept_user_id uuid not null,
  duplicate_user_id uuid not null,
  kept_email text,
  duplicate_email text,
  contact_number text,
  merge_reason text not null,
  merged_at timestamptz not null default now()
);

alter table public.account_merge_audit enable row level security;

drop policy if exists "account_merge_audit_admin_read" on public.account_merge_audit;
create policy "account_merge_audit_admin_read"
on public.account_merge_audit for select to authenticated
using (public.is_admin());

create or replace function public.merge_user_account_into(
  p_keep_user_id uuid,
  p_duplicate_user_id uuid,
  p_reason text default 'Duplicate normalized contact number'
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  keep_profile public.profiles;
  duplicate_profile public.profiles;
  keep_email text;
  duplicate_email text;
  keep_contact text;
  duplicate_contact text;
begin
  if p_keep_user_id = p_duplicate_user_id then
    raise exception 'The survivor and duplicate account must be different';
  end if;

  select * into keep_profile from public.profiles where id = p_keep_user_id for update;
  select * into duplicate_profile from public.profiles where id = p_duplicate_user_id for update;
  if keep_profile.id is null or duplicate_profile.id is null then
    raise exception 'Both profiles must exist before merging';
  end if;
  keep_contact := public.normalize_ph_mobile_contact(keep_profile.contact_number);
  duplicate_contact := public.normalize_ph_mobile_contact(duplicate_profile.contact_number);
  if keep_contact is null or keep_contact is distinct from duplicate_contact then
    raise exception 'Accounts must have the same normalized contact number';
  end if;

  select email into keep_email from auth.users where id = p_keep_user_id;
  select email into duplicate_email from auth.users where id = p_duplicate_user_id;

  -- Resolve tables whose uniqueness includes user_id before reassigning rows.
  update public.event_evaluations keeper
  set
    accommodation = duplicate.accommodation,
    time_management = duplicate.time_management,
    objectives_of_the_event = duplicate.objectives_of_the_event,
    organization_of_the_program = duplicate.organization_of_the_program,
    effectiveness_of_resource_speakers = duplicate.effectiveness_of_resource_speakers,
    committee_heads_and_staffs = duplicate.committee_heads_and_staffs,
    comment = coalesce(duplicate.comment, keeper.comment),
    submitted_at = greatest(keeper.submitted_at, duplicate.submitted_at)
  from public.event_evaluations duplicate
  where keeper.user_id = p_keep_user_id
    and duplicate.user_id = p_duplicate_user_id
    and keeper.event_id = duplicate.event_id
    and duplicate.updated_at > keeper.updated_at;

  delete from public.event_evaluations duplicate
  using public.event_evaluations keeper
  where duplicate.user_id = p_duplicate_user_id
    and keeper.user_id = p_keep_user_id
    and duplicate.event_id = keeper.event_id;

  delete from public.evaluation_reward_history duplicate
  using public.evaluation_reward_history keeper
  where duplicate.user_id = p_duplicate_user_id
    and keeper.user_id = p_keep_user_id
    and duplicate.event_id = keeper.event_id;

  delete from public.one_card_redeem_code_claims duplicate
  using public.one_card_redeem_code_claims keeper
  where duplicate.user_id = p_duplicate_user_id
    and keeper.user_id = p_keep_user_id
    and duplicate.redeem_code_id = keeper.redeem_code_id;

  update public.local_churches set created_by = p_keep_user_id where created_by = p_duplicate_user_id;
  update public.local_church_members set submitted_by = p_keep_user_id where submitted_by = p_duplicate_user_id;
  update public.local_church_members set reviewed_by = p_keep_user_id where reviewed_by = p_duplicate_user_id;
  update public.member_review_logs set reviewed_by = p_keep_user_id where reviewed_by = p_duplicate_user_id;
  update public.events set created_by = p_keep_user_id where created_by = p_duplicate_user_id;
  update public.event_evaluations set user_id = p_keep_user_id where user_id = p_duplicate_user_id;
  update public.evaluation_reward_history set user_id = p_keep_user_id where user_id = p_duplicate_user_id;
  update public.image_submissions set submitted_by = p_keep_user_id where submitted_by = p_duplicate_user_id;
  update public.image_submissions set reviewed_by = p_keep_user_id where reviewed_by = p_duplicate_user_id;
  update public.one_card_points set user_id = p_keep_user_id where user_id = p_duplicate_user_id;
  update public.one_card_points set created_by = p_keep_user_id where created_by = p_duplicate_user_id;
  update public.one_card_redeem_codes set created_by = p_keep_user_id where created_by = p_duplicate_user_id;
  update public.one_card_redeem_code_claims set user_id = p_keep_user_id where user_id = p_duplicate_user_id;
  update public.posts_or_announcements set created_by = p_keep_user_id where created_by = p_duplicate_user_id;
  update public.rewards set created_by = p_keep_user_id where created_by = p_duplicate_user_id;
  update public.reward_claims set user_id = p_keep_user_id where user_id = p_duplicate_user_id;
  update public.reward_claims set reviewed_by = p_keep_user_id where reviewed_by = p_duplicate_user_id;
  update public.redeem_codes set user_id = p_keep_user_id where user_id = p_duplicate_user_id;
  update public.notifications set user_id = p_keep_user_id where user_id = p_duplicate_user_id;
  update public.audit_logs set admin_user_id = p_keep_user_id where admin_user_id = p_duplicate_user_id;
  update public.password_reset_activity set user_id = p_keep_user_id where user_id = p_duplicate_user_id;

  if to_regclass('public.event_registrations') is not null then
    execute 'update public.event_registrations set submitted_by = $1 where submitted_by = $2'
      using p_keep_user_id, p_duplicate_user_id;
  end if;
  if to_regclass('public.event_registration_supplements') is not null then
    execute 'update public.event_registration_supplements set submitted_by = $1 where submitted_by = $2'
      using p_keep_user_id, p_duplicate_user_id;
  end if;
  if to_regclass('public.merch_preorder_forms') is not null then
    execute 'update public.merch_preorder_forms set created_by = $1 where created_by = $2'
      using p_keep_user_id, p_duplicate_user_id;
  end if;
  if to_regclass('public.merch_preorders') is not null then
    execute 'update public.merch_preorders set submitted_by = $1 where submitted_by = $2'
      using p_keep_user_id, p_duplicate_user_id;
  end if;
  if to_regclass('public.merch_preorder_supplements') is not null then
    execute 'update public.merch_preorder_supplements set submitted_by = $1 where submitted_by = $2'
      using p_keep_user_id, p_duplicate_user_id;
  end if;

  -- Fill only missing survivor details. The survivor's email remains unchanged.
  update public.profiles
  set
   role = (
  case
    when role = 'admin'::public.user_role
      or duplicate_profile.role = 'admin'::public.user_role
    then 'admin'::public.user_role
    else 'user'::public.user_role
  end
),
    full_name = coalesce(nullif(full_name, ''), duplicate_profile.full_name),
    name = coalesce(nullif(name, ''), duplicate_profile.name),
    avatar_url = coalesce(avatar_url, duplicate_profile.avatar_url),
    local_church_id = coalesce(local_church_id, duplicate_profile.local_church_id),
    name_completed = name_completed or duplicate_profile.name_completed
  where id = p_keep_user_id;

  insert into public.account_merge_audit (
    kept_user_id,
    duplicate_user_id,
    kept_email,
    duplicate_email,
    contact_number,
    merge_reason
  ) values (
    p_keep_user_id,
    p_duplicate_user_id,
    keep_email,
    duplicate_email,
    keep_contact,
    p_reason
  );

  -- Deleting from auth.users removes only the now-empty duplicate profile.
  delete from auth.users where id = p_duplicate_user_id;
end;
$$;

revoke all on function public.merge_user_account_into(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.merge_all_duplicate_contact_accounts()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  duplicate_contact record;
  account record;
  survivor_id uuid;
  merged_count integer := 0;
begin
  for duplicate_contact in
    select public.normalize_ph_mobile_contact(contact_number) as contact_number
    from public.profiles
    where public.normalize_ph_mobile_contact(contact_number) is not null
    group by public.normalize_ph_mobile_contact(contact_number)
    having count(*) > 1
  loop
    survivor_id := null;
    for account in
      select
        profile.id,
        greatest(
          coalesce(auth_user.last_sign_in_at, '-infinity'::timestamptz),
          coalesce(auth_user.updated_at, '-infinity'::timestamptz),
          coalesce(profile.updated_at, '-infinity'::timestamptz),
          coalesce((select max(points.created_at) from public.one_card_points points where points.user_id = profile.id), '-infinity'::timestamptz),
          coalesce((select max(claim.created_at) from public.reward_claims claim where claim.user_id = profile.id), '-infinity'::timestamptz),
          coalesce((select max(member.created_at) from public.local_church_members member where member.submitted_by = profile.id), '-infinity'::timestamptz)
        ) as latest_activity
      from public.profiles profile
      join auth.users auth_user on auth_user.id = profile.id
      where public.normalize_ph_mobile_contact(profile.contact_number) = duplicate_contact.contact_number
      order by latest_activity desc, profile.created_at desc
    loop
      if survivor_id is null then
        survivor_id := account.id;
      else
        perform public.merge_user_account_into(
          survivor_id,
          account.id,
          'Automatic merge: duplicate normalized contact; survivor chosen by latest account activity'
        );
        merged_count := merged_count + 1;
      end if;
    end loop;
  end loop;

  -- Normalize every surviving valid number only after duplicate accounts have
  -- been removed, so the uniqueness trigger cannot block the consolidation.
  update public.profiles
  set contact_number = public.normalize_ph_mobile_contact(contact_number)
  where public.normalize_ph_mobile_contact(contact_number) is not null
    and contact_number is distinct from public.normalize_ph_mobile_contact(contact_number);

  if not exists (
    select 1 from public.profiles
    where contact_number is not null
    group by contact_number
    having count(*) > 1
  ) then
    execute 'create unique index if not exists profiles_contact_number_unique on public.profiles(contact_number) where contact_number is not null';
  end if;

  return merged_count;
end;
$$;

revoke all on function public.merge_all_duplicate_contact_accounts() from public, anon, authenticated;

-- REVIEW DUPLICATES FIRST:
select
  public.normalize_ph_mobile_contact(profile.contact_number) as normalized_contact_number,
  profile.contact_number as stored_contact_number,
  profile.id,
  auth_user.email,
  auth_user.last_sign_in_at,
  profile.updated_at
from public.profiles profile
join auth.users auth_user on auth_user.id = profile.id
where public.normalize_ph_mobile_contact(profile.contact_number) in (
  select public.normalize_ph_mobile_contact(contact_number)
  from public.profiles
  where public.normalize_ph_mobile_contact(contact_number) is not null
  group by public.normalize_ph_mobile_contact(contact_number)
  having count(*) > 1
)
order by normalized_contact_number, auth_user.last_sign_in_at desc nulls last, profile.updated_at desc;

-- AFTER BACKUP AND REVIEW, run this separately in SQL Editor:
-- select public.merge_all_duplicate_contact_accounts();
