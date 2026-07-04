-- NELPAC profile church, Philippine mobile validation, and reward voucher view.
-- Run once in Supabase SQL Editor after supabase-schema.sql and, when used,
-- supabase-event-registration-merch-schema.sql.

alter table public.profiles
  add column if not exists local_church_id uuid references public.local_churches(id) on delete set null;

-- Normalize legacy Philippine mobile formats before any profile update. This
-- converts +639XXXXXXXXX / 639XXXXXXXXX / 9XXXXXXXXX into 09XXXXXXXXX.
update public.profiles
set contact_number = case
  when regexp_replace(coalesce(contact_number, ''), '[^0-9]', '', 'g') ~ '^639[0-9]{9}$'
    then '0' || substr(regexp_replace(contact_number, '[^0-9]', '', 'g'), 3)
  when regexp_replace(coalesce(contact_number, ''), '[^0-9]', '', 'g') ~ '^9[0-9]{9}$'
    then '0' || regexp_replace(contact_number, '[^0-9]', '', 'g')
  when regexp_replace(coalesce(contact_number, ''), '[^0-9]', '', 'g') ~ '^09[0-9]{9}$'
    then regexp_replace(contact_number, '[^0-9]', '', 'g')
  else null
end
where contact_number is not null
  and contact_number !~ '^09[0-9]{9}$';

update public.local_churches
set contact_number = case
  when regexp_replace(coalesce(contact_number, ''), '[^0-9]', '', 'g') ~ '^639[0-9]{9}$'
    then '0' || substr(regexp_replace(contact_number, '[^0-9]', '', 'g'), 3)
  when regexp_replace(coalesce(contact_number, ''), '[^0-9]', '', 'g') ~ '^9[0-9]{9}$'
    then '0' || regexp_replace(contact_number, '[^0-9]', '', 'g')
  when regexp_replace(coalesce(contact_number, ''), '[^0-9]', '', 'g') ~ '^09[0-9]{9}$'
    then regexp_replace(contact_number, '[^0-9]', '', 'g')
  else null
end
where contact_number is not null
  and contact_number !~ '^09[0-9]{9}$';

update public.local_church_members
set
  contact_number = case
    when regexp_replace(coalesce(contact_number, ''), '[^0-9]', '', 'g') ~ '^639[0-9]{9}$'
      then '0' || substr(regexp_replace(contact_number, '[^0-9]', '', 'g'), 3)
    when regexp_replace(coalesce(contact_number, ''), '[^0-9]', '', 'g') ~ '^9[0-9]{9}$'
      then '0' || regexp_replace(contact_number, '[^0-9]', '', 'g')
    when regexp_replace(coalesce(contact_number, ''), '[^0-9]', '', 'g') ~ '^09[0-9]{9}$'
      then regexp_replace(contact_number, '[^0-9]', '', 'g')
    else null
  end,
  emergency_contact = case
    when regexp_replace(coalesce(emergency_contact, ''), '[^0-9]', '', 'g') ~ '^639[0-9]{9}$'
      then '0' || substr(regexp_replace(emergency_contact, '[^0-9]', '', 'g'), 3)
    when regexp_replace(coalesce(emergency_contact, ''), '[^0-9]', '', 'g') ~ '^9[0-9]{9}$'
      then '0' || regexp_replace(emergency_contact, '[^0-9]', '', 'g')
    when regexp_replace(coalesce(emergency_contact, ''), '[^0-9]', '', 'g') ~ '^09[0-9]{9}$'
      then regexp_replace(emergency_contact, '[^0-9]', '', 'g')
    else null
  end
where (contact_number is not null and contact_number !~ '^09[0-9]{9}$')
   or (emergency_contact is not null and emergency_contact !~ '^09[0-9]{9}$');

update public.profiles profile
set local_church_id = (
  select member.local_church_id
  from public.local_church_members member
  where member.submitted_by = profile.id
  order by member.created_at desc
  limit 1
)
where profile.local_church_id is null
  and exists (
    select 1 from public.local_church_members member
    where member.submitted_by = profile.id
  );

comment on column public.profiles.local_church_id is
  'User-selected local church used as the source of truth for new member records and forms.';

drop function if exists public.update_my_profile(text, text, text);
drop function if exists public.update_my_profile(text, text, text, uuid);

create or replace function public.update_my_profile(
  p_full_name text default null,
  p_avatar_url text default null,
  p_contact_number text default null,
  p_local_church_id uuid default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_full_name is not null
    and array_length(regexp_split_to_array(trim(regexp_replace(p_full_name, '\s+', ' ', 'g')), '\s+'), 1) < 2
  then
    raise exception 'Please enter your first name and last name before continuing';
  end if;

  if p_contact_number is not null and p_contact_number !~ '^09[0-9]{9}$' then
    raise exception 'Contact number must be an 11-digit Philippine mobile number starting with 09';
  end if;

  if p_local_church_id is not null and not exists (
    select 1 from public.local_churches
    where id = p_local_church_id and is_active = true
  ) then
    raise exception 'Please select an active local church';
  end if;

  update public.profiles
  set
    full_name = coalesce(nullif(trim(regexp_replace(p_full_name, '\s+', ' ', 'g')), ''), full_name),
    name_completed = (
      array_length(
        regexp_split_to_array(
          trim(regexp_replace(coalesce(nullif(p_full_name, ''), full_name), '\s+', ' ', 'g')),
          '\s+'
        ),
        1
      ) >= 2
      and coalesce(p_contact_number, contact_number, '') ~ '^09[0-9]{9}$'
    ),
    avatar_url = coalesce(p_avatar_url, avatar_url),
    contact_number = coalesce(p_contact_number, contact_number),
    local_church_id = coalesce(p_local_church_id, local_church_id)
  where id = auth.uid()
  returning * into updated_profile;

  if p_local_church_id is not null then
    update public.local_church_members
    set local_church_id = p_local_church_id
    where submitted_by = auth.uid()
      and local_church_id is distinct from p_local_church_id;
  end if;

  return updated_profile;
end;
$$;

create or replace function public.sync_profile_church_from_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set local_church_id = new.local_church_id
  where id = new.submitted_by
    and local_church_id is null;
  return new;
end;
$$;

drop trigger if exists sync_profile_church_from_member_trigger
on public.local_church_members;
create trigger sync_profile_church_from_member_trigger
after insert on public.local_church_members
for each row execute function public.sync_profile_church_from_member();

do $$ begin
  alter table public.profiles
    add constraint profiles_contact_number_ph_mobile_check
    check (contact_number is null or contact_number ~ '^09[0-9]{9}$') not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.local_churches
    add constraint local_churches_contact_number_ph_mobile_check
    check (contact_number is null or contact_number ~ '^09[0-9]{9}$') not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.local_church_members
    add constraint members_contact_number_ph_mobile_check
    check (contact_number is null or contact_number ~ '^09[0-9]{9}$') not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  if to_regclass('public.event_registrations') is not null then
    alter table public.event_registrations
      add constraint event_worker_contact_ph_mobile_check
      check (worker_contact_number ~ '^09[0-9]{9}$') not valid;
  end if;
exception when duplicate_object then null;
end $$;

do $$ begin
  if to_regclass('public.event_registrations') is not null then
    alter table public.event_registrations
      add constraint event_president_contact_ph_mobile_check
      check (president_contact_number ~ '^09[0-9]{9}$') not valid;
  end if;
exception when duplicate_object then null;
end $$;

do $$ begin
  if to_regclass('public.merch_preorders') is not null then
    alter table public.merch_preorders
      add constraint merch_president_contact_ph_mobile_check
      check (president_contact_number ~ '^09[0-9]{9}$') not valid;
  end if;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.local_church_members
    add constraint members_emergency_contact_ph_mobile_check
    check (emergency_contact is null or emergency_contact ~ '^09[0-9]{9}$') not valid;
exception when duplicate_object then null;
end $$;

create or replace function public.enforce_unique_profile_contact_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_contact text;
begin
  if new.contact_number is null or nullif(trim(new.contact_number), '') is null then
    new.contact_number := null;
    return new;
  end if;

  normalized_contact := regexp_replace(new.contact_number, '[^0-9]', '', 'g');
  if normalized_contact ~ '^639[0-9]{9}$' then
    normalized_contact := '0' || substr(normalized_contact, 3);
  elsif normalized_contact ~ '^9[0-9]{9}$' then
    normalized_contact := '0' || normalized_contact;
  end if;

  if normalized_contact !~ '^09[0-9]{9}$' then
    raise exception 'Contact number must be an 11-digit Philippine mobile number starting with 09';
  end if;

  new.contact_number := normalized_contact;

  if exists (
    select 1
    from public.profiles existing
    where existing.contact_number = normalized_contact
      and existing.id <> new.id
  ) then
    raise exception 'CONTACT_NUMBER_ALREADY_REGISTERED';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_unique_profile_contact_number_trigger
on public.profiles;
create trigger enforce_unique_profile_contact_number_trigger
before insert or update of contact_number on public.profiles
for each row execute function public.enforce_unique_profile_contact_number();

do $$ begin
  if not exists (
    select 1
    from public.profiles
    where contact_number is not null
    group by contact_number
    having count(*) > 1
  ) then
    create unique index if not exists profiles_contact_number_unique
    on public.profiles(contact_number)
    where contact_number is not null;
  end if;
end $$;

create or replace function public.check_registration_identity(
  p_email text,
  p_contact_number text
)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_email text := lower(trim(coalesce(p_email, '')));
  normalized_contact text := regexp_replace(coalesce(p_contact_number, ''), '[^0-9]', '', 'g');
begin
  if normalized_contact ~ '^639[0-9]{9}$' then
    normalized_contact := '0' || substr(normalized_contact, 3);
  elsif normalized_contact ~ '^9[0-9]{9}$' then
    normalized_contact := '0' || normalized_contact;
  end if;

  if exists (
    select 1 from auth.users account
    where lower(account.email) = normalized_email
  ) then
    return 'email_exists';
  end if;

  if exists (
    select 1 from public.profiles profile
    where profile.contact_number = normalized_contact
  ) then
    return 'contact_exists';
  end if;

  return 'available';
end;
$$;

revoke all on function public.check_registration_identity(text, text) from public;
grant execute on function public.check_registration_identity(text, text) to anon, authenticated;

create or replace view public.reward_claims_with_rewards
with (security_invoker = true)
as
select
  rc.id,
  rc.user_id,
  rc.reward_id,
  r.name as reward_name,
  r.description as reward_description,
  r.image_url as reward_image_url,
  rc.claim_status,
  rc.points_used,
  rc.admin_notes,
  rc.reviewed_by,
  rc.reviewed_at,
  rc.claimed_at,
  rc.created_at,
  rc.updated_at,
  code.code as voucher_code,
  code.expires_at as voucher_expires_at,
  code.is_used as voucher_used,
  code.used_at as voucher_used_at
from public.reward_claims rc
join public.rewards r on r.id = rc.reward_id
left join public.redeem_codes code on code.claim_id = rc.id;

comment on view public.reward_claims_with_rewards is
  'Claim history with reward details and the officer-verifiable voucher generated after approval.';
