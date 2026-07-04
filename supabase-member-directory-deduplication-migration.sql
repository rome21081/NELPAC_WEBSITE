-- NELPAC same-church member directory and duplicate-person prevention.
-- Run after supabase-schema.sql and
-- supabase-profile-church-phone-voucher-migration.sql.

create or replace function public.normalize_member_name(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')));
$$;

create or replace function public.enforce_unique_local_church_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_contact text;
  normalized_name text;
begin
  normalized_contact := regexp_replace(coalesce(new.contact_number, ''), '[^0-9]', '', 'g');
  if normalized_contact ~ '^639[0-9]{9}$' then
    normalized_contact := '0' || substr(normalized_contact, 3);
  elsif normalized_contact ~ '^9[0-9]{9}$' then
    normalized_contact := '0' || normalized_contact;
  end if;

  if normalized_contact !~ '^09[0-9]{9}$' then
    raise exception 'Member contact number must be an 11-digit Philippine mobile number starting with 09';
  end if;

  new.contact_number := normalized_contact;
  normalized_name := public.normalize_member_name(new.name);

  if exists (
    select 1
    from public.profiles profile
    where profile.contact_number = normalized_contact
      and profile.id <> new.submitted_by
  ) then
    raise exception 'MEMBER_CONTACT_ALREADY_HAS_ACCOUNT';
  end if;

  if exists (
    select 1
    from public.local_church_members member
    where member.contact_number = normalized_contact
      and member.id <> new.id
  ) then
    raise exception 'MEMBER_ALREADY_REGISTERED_CONTACT';
  end if;

  if exists (
    select 1
    from public.local_church_members member
    where member.birthday = new.birthday
      and public.normalize_member_name(member.name) = normalized_name
      and member.id <> new.id
  ) then
    raise exception 'MEMBER_ALREADY_REGISTERED_NAME_BIRTHDAY';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_unique_local_church_member_trigger
on public.local_church_members;
create trigger enforce_unique_local_church_member_trigger
before insert or update of name, birthday, contact_number, submitted_by
on public.local_church_members
for each row execute function public.enforce_unique_local_church_member();

create index if not exists local_church_members_normalized_name_birthday_idx
on public.local_church_members (public.normalize_member_name(name), birthday);

create or replace function public.list_my_local_church_directory()
returns table (
  id uuid,
  submitted_by uuid,
  name text,
  gender public.gender_type,
  local_church_id uuid,
  local_church_name text,
  district public.nelpac_district,
  confirmation_class_status public.confirmation_class_status,
  activity_status public.member_activity_status,
  review_status public.review_status,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    member.id,
    member.submitted_by,
    member.name,
    member.gender,
    member.local_church_id,
    church.name,
    church.district,
    member.confirmation_class_status,
    member.activity_status,
    member.review_status,
    member.created_at
  from public.local_church_members member
  join public.local_churches church on church.id = member.local_church_id
  join public.profiles viewer on viewer.id = auth.uid()
  where member.local_church_id = viewer.local_church_id
    and member.review_status = 'Approved'
  order by member.name;
$$;

revoke all on function public.list_my_local_church_directory() from public;
grant execute on function public.list_my_local_church_directory() to authenticated;

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

  if exists (select 1 from auth.users account where lower(account.email) = normalized_email) then
    return 'email_exists';
  end if;
  if exists (select 1 from public.profiles profile where profile.contact_number = normalized_contact) then
    return 'contact_exists';
  end if;
  if exists (select 1 from public.local_church_members member where member.contact_number = normalized_contact) then
    return 'member_exists';
  end if;
  return 'available';
end;
$$;

revoke all on function public.check_registration_identity(text, text) from public;
grant execute on function public.check_registration_identity(text, text) to anon, authenticated;

