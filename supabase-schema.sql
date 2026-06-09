-- NELPAC System Supabase schema
-- Paste this whole file into the Supabase SQL Editor.
-- It is designed for a React/Vue frontend using Supabase Auth + supabase-js.

create extension if not exists "pgcrypto";

insert into storage.buckets (id, name, public)
values ('nelpac-images', 'nelpac-images', true)
on conflict (id) do update
set public = excluded.public;

insert into storage.buckets (id, name, public)
values
  ('event-images', 'event-images', true),
  ('post-images', 'post-images', true),
  ('reward-images', 'reward-images', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "nelpac_images_public_read" on storage.objects;
create policy "nelpac_images_public_read"
on storage.objects for select
to public
using (bucket_id = 'nelpac-images');

drop policy if exists "nelpac_images_authenticated_upload" on storage.objects;
create policy "nelpac_images_authenticated_upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'nelpac-images');

drop policy if exists "nelpac_images_owner_update" on storage.objects;
create policy "nelpac_images_owner_update"
on storage.objects for update
to authenticated
using (bucket_id = 'nelpac-images' and owner = auth.uid())
with check (bucket_id = 'nelpac-images' and owner = auth.uid());

-- =========================
-- Enums
-- =========================

do $$ begin
  create type public.user_role as enum ('user', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.nelpac_district as enum ('ISED', 'ISIED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.gender_type as enum ('Male', 'Female', 'Prefer not to say');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.yes_no as enum ('Yes', 'No');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.confirmation_class_status as enum ('Not Started', 'Ongoing', 'Completed', 'Dropped');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.member_activity_status as enum ('Active', 'Inactive');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.review_status as enum ('Pending', 'Approved', 'Rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.event_status as enum ('Draft', 'Published', 'Completed', 'Cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.image_submission_status as enum ('Pending', 'Approved', 'Rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.post_status as enum ('Draft', 'Published', 'Archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.points_entry_type as enum ('earned', 'redeemed', 'adjustment');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.reward_claim_status as enum ('Pending', 'Approved', 'Rejected', 'Claimed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.notification_type as enum (
    'member_review',
    'event_reminder',
    'reward_claim',
    'image_review',
    'announcement',
    'points',
    'system'
  );
exception when duplicate_object then null;
end $$;

-- =========================
-- Shared Helpers
-- =========================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================
-- Profiles
-- =========================
-- Email is copied from auth.users for frontend convenience.
-- Treat auth.users.email as the source of truth for login identity.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'user',
  full_name text not null default '',
  email text unique,
  avatar_url text,
  contact_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Public app profile for every Supabase Auth user.';
comment on column public.profiles.role is 'Only admins should change this. Normal users are always user.';

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

drop policy if exists "nelpac_admin_media_public_read" on storage.objects;
create policy "nelpac_admin_media_public_read"
on storage.objects for select
to public
using (bucket_id in ('event-images', 'post-images', 'reward-images'));

drop policy if exists "nelpac_admin_media_authenticated_upload" on storage.objects;
create policy "nelpac_admin_media_authenticated_upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('event-images', 'post-images', 'reward-images')
  and public.is_admin()
);

drop policy if exists "nelpac_admin_media_authenticated_update" on storage.objects;
create policy "nelpac_admin_media_authenticated_update"
on storage.objects for update
to authenticated
using (
  bucket_id in ('event-images', 'post-images', 'reward-images')
  and public.is_admin()
)
with check (
  bucket_id in ('event-images', 'post-images', 'reward-images')
  and public.is_admin()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, contact_number, avatar_url, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.email,
    new.raw_user_meta_data ->> 'contact_number',
    new.raw_user_meta_data ->> 'avatar_url',
    'user'
  )
  on conflict (id) do nothing;

  if (new.raw_user_meta_data ? 'local_church_id')
    and (new.raw_user_meta_data ? 'birthday')
    and coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', '') <> ''
  then
    insert into public.local_church_members (
      submitted_by,
      local_church_id,
      name,
      birthday,
      contact_number,
      gender,
      address,
      parent_guardian_name,
      emergency_contact,
      professing_member,
      confirmation_class_year,
      confirmation_class_status,
      activity_status
    )
    values (
      new.id,
      (new.raw_user_meta_data ->> 'local_church_id')::uuid,
      coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', ''),
      (new.raw_user_meta_data ->> 'birthday')::date,
      new.raw_user_meta_data ->> 'contact_number',
      nullif(new.raw_user_meta_data ->> 'gender', '')::public.gender_type,
      new.raw_user_meta_data ->> 'address',
      new.raw_user_meta_data ->> 'parent_guardian_name',
      new.raw_user_meta_data ->> 'emergency_contact',
      coalesce(nullif(new.raw_user_meta_data ->> 'professing_member', ''), 'No')::public.yes_no,
      nullif(new.raw_user_meta_data ->> 'confirmation_class_year', '')::integer,
      coalesce(nullif(new.raw_user_meta_data ->> 'confirmation_class_status', ''), 'Not Started')::public.confirmation_class_status,
      coalesce(nullif(new.raw_user_meta_data ->> 'activity_status', ''), 'Active')::public.member_activity_status
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Safe user profile update. Users can call this instead of directly updating profiles.
create or replace function public.update_my_profile(
  p_full_name text default null,
  p_avatar_url text default null,
  p_contact_number text default null
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

  update public.profiles
  set
    full_name = coalesce(p_full_name, full_name),
    avatar_url = coalesce(p_avatar_url, avatar_url),
    contact_number = coalesce(p_contact_number, contact_number)
  where id = auth.uid()
  returning * into updated_profile;

  return updated_profile;
end;
$$;

-- Admin-only role update.
create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role public.user_role
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Only admins can update user roles';
  end if;

  update public.profiles
  set role = p_role
  where id = p_user_id
  returning * into updated_profile;

  return updated_profile;
end;
$$;

-- =========================
-- Local Churches
-- =========================

create table if not exists public.local_churches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district public.nelpac_district not null,
  address text,
  contact_person text,
  contact_number text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint local_churches_name_district_unique unique (name, district)
);

comment on table public.local_churches is 'Normalized list of NELPAC local churches used by members, events, and reports.';

drop trigger if exists set_local_churches_updated_at on public.local_churches;
create trigger set_local_churches_updated_at
before update on public.local_churches
for each row execute function public.set_updated_at();

insert into public.local_churches (name, district, is_active)
values
  ('Amazing Grace MC', 'ISED', true),
  ('Arabiat MC', 'ISED', true),
  ('Bacradal MC', 'ISED', true),
  ('Bethel MC', 'ISED', true),
  ('Calaocan MC', 'ISED', true),
  ('Castillo MC', 'ISED', true),
  ('Dabubu Grande UMC', 'ISED', true),
  ('Dabubu Pequeno UMC', 'ISED', true),
  ('Diarao UMC', 'ISED', true),
  ('FEUMCI', 'ISED', true),
  ('Garit Norte UMC', 'ISED', true),
  ('Gomez UMC', 'ISED', true),
  ('Gumbauan MC', 'ISED', true),
  ('Jones UMC', 'ISED', true),
  ('Kalediggan MC', 'ISED', true),
  ('Libertad UMC', 'ISED', true),
  ('Lusod MC', 'ISED', true),
  ('Mapalad UMC', 'ISED', true),
  ('Masaya Centro UMC', 'ISED', true),
  ('Napaliong UMC', 'ISED', true),
  ('Nemmatan UMC', 'ISED', true),
  ('Paddad MC', 'ISED', true),
  ('Pangal Norte UMC', 'ISED', true),
  ('Pangal Sur UMC', 'ISED', true),
  ('Philippians UMC', 'ISED', true),
  ('Quezon UMC', 'ISED', true),
  ('Quimalabasa Norte UMC', 'ISED', true),
  ('Rizal UMC', 'ISED', true),
  ('Rizal West UMC', 'ISED', true),
  ('Salvation MC', 'ISED', true),
  ('San Ambrocio MC', 'ISED', true),
  ('San Guillermo UMC', 'ISED', true),
  ('San Salvador MC', 'ISED', true),
  ('Sinalugan MC', 'ISED', true),
  ('Sta. Ana UMC', 'ISED', true),
  ('Sta. Cruz UMC', 'ISED', true),
  ('Sta. Monica UMC', 'ISED', true),
  ('Sto. Domingo UMC', 'ISED', true),
  ('Stone of Hope UMC', 'ISED', true),
  ('Victoria UMC', 'ISED', true),
  ('Villaflor UMC', 'ISED', true),
  ('Virgoneza UMC', 'ISED', true),
  ('Aldersgate UMC', 'ISIED', true),
  ('Alfonso Lista First UMC', 'ISIED', true),
  ('Bagong Sikat UMC', 'ISIED', true),
  ('Burgos UMC', 'ISIED', true),
  ('Cabatuan UMC', 'ISIED', true),
  ('Crossroad UMC', 'ISIED', true),
  ('Gaddanan UMC', 'ISIED', true),
  ('General Aguinaldo UMC', 'ISIED', true),
  ('Grace UMC', 'ISIED', true),
  ('La Paz UMC', 'ISIED', true),
  ('Nagbacalan MC', 'ISIED', true),
  ('Namillangan UMC', 'ISIED', true),
  ('Namnama UMC', 'ISIED', true),
  ('Oscariz UMC', 'ISIED', true),
  ('Pagrang-ayan MC', 'ISIED', true),
  ('Planas MC', 'ISIED', true),
  ('Ramon UMC', 'ISIED', true),
  ('Rising Hope MC', 'ISIED', true),
  ('Salinungan East UMC', 'ISIED', true),
  ('Salinungan West UMC', 'ISIED', true),
  ('San Marcos UMC', 'ISIED', true),
  ('San Mateo UMC', 'ISIED', true),
  ('San Quintin UMC', 'ISIED', true),
  ('San Sebastian UMC', 'ISIED', true),
  ('Santa Maria MC', 'ISIED', true),
  ('Sinamar Norte UMC', 'ISIED', true),
  ('Sinamar Sur UMC', 'ISIED', true),
  ('Tandul UMC', 'ISIED', true),
  ('Victoria MC', 'ISIED', true),
  ('Villa Cruz UMC', 'ISIED', true),
  ('Villa Fuerte UMC', 'ISIED', true),
  ('Villa Magat UMC', 'ISIED', true),
  ('Villa Marcos MC', 'ISIED', true),
  ('Wesley UMC', 'ISIED', true),
  ('Zion UMC', 'ISIED', true)
on conflict (name, district) do update
set
  is_active = excluded.is_active,
  updated_at = now();

-- =========================
-- Local Church Members
-- =========================

create table if not exists public.local_church_members (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  local_church_id uuid not null references public.local_churches(id) on delete restrict,
  name text not null,
  birthday date not null,
  contact_number text,
  gender public.gender_type,
  address text,
  parent_guardian_name text,
  emergency_contact text,
  professing_member public.yes_no not null default 'No',
  confirmation_class_year integer check (
    confirmation_class_year is null
    or confirmation_class_year between 1900 and extract(year from now())::integer + 5
  ),
  confirmation_class_status public.confirmation_class_status not null default 'Not Started',
  activity_status public.member_activity_status not null default 'Active',
  review_status public.review_status not null default 'Pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint local_church_members_review_fields_check check (
    (review_status = 'Pending' and reviewed_by is null and reviewed_at is null)
    or (review_status in ('Approved', 'Rejected') and reviewed_by is not null and reviewed_at is not null)
  )
);

comment on table public.local_church_members is 'User-submitted church member records. Age is computed in the frontend from birthday.';
comment on column public.local_church_members.review_status is 'Changed only through admin_review_member_application RPC or admin policies.';

drop trigger if exists set_local_church_members_updated_at on public.local_church_members;
create trigger set_local_church_members_updated_at
before update on public.local_church_members
for each row execute function public.set_updated_at();

create table if not exists public.member_review_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.local_church_members(id) on delete cascade,
  reviewed_by uuid not null references public.profiles(id) on delete restrict,
  old_status public.review_status,
  new_status public.review_status not null,
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.member_review_logs is 'Audit log for admin approval or rejection of member records.';

-- User-safe member update. Users cannot touch review fields through this function.
create or replace function public.update_my_member_application(
  p_member_id uuid,
  p_local_church_id uuid,
  p_name text,
  p_birthday date,
  p_contact_number text default null,
  p_gender public.gender_type default null,
  p_address text default null,
  p_parent_guardian_name text default null,
  p_emergency_contact text default null,
  p_professing_member public.yes_no default 'No',
  p_confirmation_class_year integer default null,
  p_confirmation_class_status public.confirmation_class_status default 'Not Started',
  p_activity_status public.member_activity_status default 'Active'
)
returns public.local_church_members
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_member public.local_church_members;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.local_church_members
  set
    local_church_id = p_local_church_id,
    name = p_name,
    birthday = p_birthday,
    contact_number = p_contact_number,
    gender = p_gender,
    address = p_address,
    parent_guardian_name = p_parent_guardian_name,
    emergency_contact = p_emergency_contact,
    professing_member = p_professing_member,
    confirmation_class_year = p_confirmation_class_year,
    confirmation_class_status = p_confirmation_class_status,
    activity_status = p_activity_status,
    review_status = 'Pending',
    reviewed_by = null,
    reviewed_at = null,
    admin_notes = null
  where id = p_member_id
    and submitted_by = auth.uid()
    and review_status in ('Pending', 'Rejected')
  returning * into updated_member;

  if updated_member.id is null then
    raise exception 'Member record not found or cannot be edited';
  end if;

  return updated_member;
end;
$$;

-- Admin-only review workflow with audit logging.
create or replace function public.admin_review_member_application(
  p_member_id uuid,
  p_new_status public.review_status,
  p_admin_notes text default null
)
returns public.local_church_members
language plpgsql
security definer
set search_path = public
as $$
declare
  old_member public.local_church_members;
  updated_member public.local_church_members;
begin
  if not public.is_admin() then
    raise exception 'Only admins can review member applications';
  end if;

  if p_new_status = 'Pending' then
    raise exception 'Use Approved or Rejected for admin review';
  end if;

  select * into old_member
  from public.local_church_members
  where id = p_member_id;

  if old_member.id is null then
    raise exception 'Member record not found';
  end if;

  update public.local_church_members
  set
    review_status = p_new_status,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    admin_notes = p_admin_notes
  where id = p_member_id
  returning * into updated_member;

  insert into public.member_review_logs (member_id, reviewed_by, old_status, new_status, notes)
  values (p_member_id, auth.uid(), old_member.review_status, p_new_status, p_admin_notes);

  insert into public.notifications (user_id, title, message, type)
  values (
    old_member.submitted_by,
    'Member application ' || lower(p_new_status::text),
    coalesce(p_admin_notes, 'Your local church member application was ' || lower(p_new_status::text) || '.'),
    'member_review'
  );

  return updated_member;
end;
$$;

-- =========================
-- Events and Evaluations
-- =========================

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date not null,
  venue text,
  local_church_id uuid references public.local_churches(id) on delete set null,
  district public.nelpac_district,
  status public.event_status not null default 'Draft',
  evaluation_enabled boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events
add column if not exists image_url text;

drop trigger if exists set_events_updated_at on public.events;
create trigger set_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create table if not exists public.event_evaluations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  speaker_rating integer not null check (speaker_rating between 1 and 5),
  venue_rating integer not null check (venue_rating between 1 and 5),
  program_rating integer not null check (program_rating between 1 and 5),
  overall_rating integer not null check (overall_rating between 1 and 5),
  comment text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_evaluations_one_per_user unique (event_id, user_id)
);

comment on table public.event_evaluations is 'One event evaluation per user per event. Admins use this table for feedback analytics.';
comment on column public.event_evaluations.user_id is 'The youth user who submitted the evaluation.';
comment on column public.event_evaluations.submitted_at is 'Frontend-friendly submission timestamp; created_at is retained for system consistency.';

drop trigger if exists set_event_evaluations_updated_at on public.event_evaluations;
create trigger set_event_evaluations_updated_at
before update on public.event_evaluations
for each row execute function public.set_updated_at();

create or replace function public.submit_event_evaluation(
  p_event_id uuid,
  p_overall_rating integer,
  p_speaker_rating integer,
  p_venue_rating integer,
  p_program_rating integer,
  p_comment text default null
)
returns public.event_evaluations
language plpgsql
security definer
set search_path = public
as $$
declare
  event_record public.events;
  new_evaluation public.event_evaluations;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into event_record
  from public.events
  where id = p_event_id
    and status in ('Published', 'Completed')
    and evaluation_enabled = true;

  if event_record.id is null then
    raise exception 'This event is not available for evaluation';
  end if;

  insert into public.event_evaluations (
    event_id,
    user_id,
    overall_rating,
    speaker_rating,
    venue_rating,
    program_rating,
    comment
  )
  values (
    p_event_id,
    auth.uid(),
    p_overall_rating,
    p_speaker_rating,
    p_venue_rating,
    p_program_rating,
    p_comment
  )
  returning * into new_evaluation;

  return new_evaluation;
end;
$$;

-- =========================
-- Image Submissions
-- =========================

create table if not exists public.image_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  local_church_id uuid references public.local_churches(id) on delete set null,
  image_url text not null,
  caption text,
  status public.image_submission_status not null default 'Pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint image_submissions_review_fields_check check (
    (status = 'Pending' and reviewed_by is null and reviewed_at is null)
    or (status in ('Approved', 'Rejected') and reviewed_by is not null and reviewed_at is not null)
  )
);

drop trigger if exists set_image_submissions_updated_at on public.image_submissions;
create trigger set_image_submissions_updated_at
before update on public.image_submissions
for each row execute function public.set_updated_at();

create or replace function public.admin_review_image_submission(
  p_submission_id uuid,
  p_new_status public.image_submission_status,
  p_admin_notes text default null
)
returns public.image_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  old_submission public.image_submissions;
  updated_submission public.image_submissions;
begin
  if not public.is_admin() then
    raise exception 'Only admins can review image submissions';
  end if;

  if p_new_status = 'Pending' then
    raise exception 'Use Approved or Rejected for admin review';
  end if;

  select * into old_submission
  from public.image_submissions
  where id = p_submission_id;

  if old_submission.id is null then
    raise exception 'Image submission not found';
  end if;

  update public.image_submissions
  set
    status = p_new_status,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    admin_notes = p_admin_notes
  where id = p_submission_id
  returning * into updated_submission;

  insert into public.notifications (user_id, title, message, type)
  values (
    old_submission.submitted_by,
    'Image submission ' || lower(p_new_status::text),
    coalesce(p_admin_notes, 'Your image submission was ' || lower(p_new_status::text) || '.'),
    'image_review'
  );

  return updated_submission;
end;
$$;

-- =========================
-- One Card Points
-- =========================

create table if not exists public.one_card_points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  entry_type public.points_entry_type not null,
  points integer not null,
  description text not null,
  event_id uuid references public.events(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint one_card_points_nonzero check (points <> 0)
);

comment on table public.one_card_points is 'Immutable ledger for NELPAC One Card points. Sum points per user for balance.';

create table if not exists public.evaluation_reward_history (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.event_evaluations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  points_awarded integer not null default 100 check (points_awarded > 0),
  points_entry_id uuid references public.one_card_points(id) on delete set null,
  reward_status text not null default 'Awarded',
  created_at timestamptz not null default now(),
  constraint evaluation_reward_history_once_per_evaluation unique (evaluation_id),
  constraint evaluation_reward_history_once_per_event_user unique (event_id, user_id)
);

comment on table public.evaluation_reward_history is 'Audit log for automatic NELPAC One Card rewards granted after completed event evaluations.';

create or replace function public.submit_event_evaluation(
  p_event_id uuid,
  p_overall_rating integer,
  p_speaker_rating integer,
  p_venue_rating integer,
  p_program_rating integer,
  p_comment text default null
)
returns public.event_evaluations
language plpgsql
security definer
set search_path = public
as $$
declare
  event_record public.events;
  new_evaluation public.event_evaluations;
  points_entry_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into event_record
  from public.events
  where id = p_event_id
    and status in ('Published', 'Completed')
    and evaluation_enabled = true;

  if event_record.id is null then
    raise exception 'This event is not available for evaluation';
  end if;

  insert into public.event_evaluations (
    event_id,
    user_id,
    overall_rating,
    speaker_rating,
    venue_rating,
    program_rating,
    comment
  )
  values (
    p_event_id,
    auth.uid(),
    p_overall_rating,
    p_speaker_rating,
    p_venue_rating,
    p_program_rating,
    p_comment
  )
  returning * into new_evaluation;

  insert into public.one_card_points (user_id, entry_type, points, description, event_id, created_by)
  values (
    auth.uid(),
    'earned',
    100,
    'Evaluation completion reward: ' || event_record.title,
    p_event_id,
    auth.uid()
  )
  returning id into points_entry_id;

  insert into public.evaluation_reward_history (
    evaluation_id,
    event_id,
    user_id,
    points_awarded,
    points_entry_id,
    reward_status
  )
  values (
    new_evaluation.id,
    p_event_id,
    auth.uid(),
    100,
    points_entry_id,
    'Awarded'
  );

  insert into public.notifications (user_id, title, message, type)
  values (
    auth.uid(),
    'Evaluation reward earned',
    'You earned 100 NELPAC Points for completing the evaluation for ' || event_record.title || '.',
    'points'
  );

  return new_evaluation;
end;
$$;

create table if not exists public.one_card_redeem_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  points integer not null check (points > 0),
  claim_limit integer not null check (claim_limit > 0),
  expires_at timestamptz not null,
  is_active boolean not null default true,
  event_id uuid references public.events(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.one_card_redeem_codes is 'Admin-created reusable NELPAC One Card points redeem codes.';

drop trigger if exists set_one_card_redeem_codes_updated_at on public.one_card_redeem_codes;
create trigger set_one_card_redeem_codes_updated_at
before update on public.one_card_redeem_codes
for each row execute function public.set_updated_at();

create table if not exists public.one_card_redeem_code_claims (
  id uuid primary key default gen_random_uuid(),
  redeem_code_id uuid not null references public.one_card_redeem_codes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  points_awarded integer not null check (points_awarded > 0),
  claimed_at timestamptz not null default now(),
  constraint one_card_redeem_code_claims_once unique (redeem_code_id, user_id)
);

comment on table public.one_card_redeem_code_claims is 'Tracks which users claimed each reusable One Card redeem code.';

create or replace view public.one_card_redeem_codes_with_usage
with (security_invoker = true)
as
select
  rc.id,
  rc.code,
  rc.points,
  rc.claim_limit,
  count(c.id)::integer as used_count,
  greatest(rc.claim_limit - count(c.id)::integer, 0) as remaining_claims,
  rc.expires_at,
  rc.is_active,
  rc.event_id,
  e.title as event_title,
  rc.created_by,
  rc.created_at,
  rc.updated_at
from public.one_card_redeem_codes rc
left join public.one_card_redeem_code_claims c on c.redeem_code_id = rc.id
left join public.events e on e.id = rc.event_id
group by rc.id, e.title;

create or replace function public.admin_create_one_card_redeem_code(
  p_code text,
  p_points integer,
  p_claim_limit integer,
  p_expires_at timestamptz,
  p_is_active boolean default true,
  p_event_id uuid default null
)
returns public.one_card_redeem_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code public.one_card_redeem_codes;
begin
  if not public.is_admin() then
    raise exception 'Only admins can create redeem codes';
  end if;

  insert into public.one_card_redeem_codes (
    code,
    points,
    claim_limit,
    expires_at,
    is_active,
    event_id,
    created_by
  )
  values (
    upper(trim(p_code)),
    p_points,
    p_claim_limit,
    p_expires_at,
    p_is_active,
    p_event_id,
    auth.uid()
  )
  returning * into new_code;

  return new_code;
end;
$$;

create or replace function public.admin_update_one_card_redeem_code(
  p_code_id uuid,
  p_code text,
  p_points integer,
  p_claim_limit integer,
  p_expires_at timestamptz,
  p_is_active boolean,
  p_event_id uuid default null
)
returns public.one_card_redeem_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_code public.one_card_redeem_codes;
begin
  if not public.is_admin() then
    raise exception 'Only admins can update redeem codes';
  end if;

  update public.one_card_redeem_codes
  set
    code = upper(trim(p_code)),
    points = p_points,
    claim_limit = p_claim_limit,
    expires_at = p_expires_at,
    is_active = p_is_active,
    event_id = p_event_id
  where id = p_code_id
  returning * into updated_code;

  if updated_code.id is null then
    raise exception 'Redeem code not found';
  end if;

  return updated_code;
end;
$$;

create or replace function public.redeem_one_card_code(p_code text)
returns public.one_card_points
language plpgsql
security definer
set search_path = public
as $$
declare
  code_record public.one_card_redeem_codes;
  used_count integer;
  new_points public.one_card_points;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into code_record
  from public.one_card_redeem_codes
  where code = upper(trim(p_code))
  for update;

  if code_record.id is null then
    raise exception 'Redeem code not found';
  end if;

  if code_record.is_active = false then
    raise exception 'Redeem code is inactive';
  end if;

  if code_record.expires_at <= now() then
    raise exception 'Redeem code has expired';
  end if;

  if exists (
    select 1 from public.one_card_redeem_code_claims
    where redeem_code_id = code_record.id
      and user_id = auth.uid()
  ) then
    raise exception 'You already claimed this redeem code';
  end if;

  select count(*)::integer into used_count
  from public.one_card_redeem_code_claims
  where redeem_code_id = code_record.id;

  if used_count >= code_record.claim_limit then
    raise exception 'Redeem code claim limit has been reached';
  end if;

  insert into public.one_card_redeem_code_claims (redeem_code_id, user_id, points_awarded)
  values (code_record.id, auth.uid(), code_record.points);

  insert into public.one_card_points (user_id, entry_type, points, description, event_id, created_by)
  values (
    auth.uid(),
    'earned',
    code_record.points,
    'Redeem code claimed: ' || code_record.code,
    code_record.event_id,
    code_record.created_by
  )
  returning * into new_points;

  insert into public.notifications (user_id, title, message, type)
  values (
    auth.uid(),
    'Redeem code claimed',
    'You earned ' || code_record.points || ' points from redeem code ' || code_record.code || '.',
    'points'
  );

  return new_points;
end;
$$;

-- =========================
-- Posts and Announcements
-- =========================

create table if not exists public.posts_or_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text not null default 'Announcement',
  status public.post_status not null default 'Draft',
  featured boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_posts_have_date check (
    status <> 'Published' or published_at is not null
  )
);

alter table public.posts_or_announcements
add column if not exists image_url text;

drop trigger if exists set_posts_or_announcements_updated_at on public.posts_or_announcements;
create trigger set_posts_or_announcements_updated_at
before update on public.posts_or_announcements
for each row execute function public.set_updated_at();

-- =========================
-- Rewards, Claims, and Redeem Codes
-- =========================

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  required_points integer not null check (required_points > 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  image_url text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.rewards is 'Reward and merch catalog users can claim with NELPAC One Card points.';
comment on column public.rewards.stock_quantity is 'Current available stock. Decremented when an admin approves a claim.';

drop trigger if exists set_rewards_updated_at on public.rewards;
create trigger set_rewards_updated_at
before update on public.rewards
for each row execute function public.set_updated_at();

create table if not exists public.reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_id uuid not null references public.rewards(id) on delete restrict,
  claim_status public.reward_claim_status not null default 'Pending',
  points_used integer not null check (points_used > 0),
  admin_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reward_claims_review_fields_check check (
    (claim_status = 'Pending' and reviewed_by is null and reviewed_at is null and claimed_at is null)
    or (claim_status in ('Approved', 'Rejected') and reviewed_by is not null and reviewed_at is not null and claimed_at is null)
    or (claim_status = 'Claimed' and reviewed_by is not null and reviewed_at is not null and claimed_at is not null)
  )
);

comment on table public.reward_claims is 'Every user reward redemption request and its admin review status.';
comment on column public.reward_claims.points_used is 'Snapshot of required points at the time the user submitted the claim.';

drop trigger if exists set_reward_claims_updated_at on public.reward_claims;
create trigger set_reward_claims_updated_at
before update on public.reward_claims
for each row execute function public.set_updated_at();

create table if not exists public.redeem_codes (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null unique references public.reward_claims(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null unique,
  expires_at timestamptz not null,
  is_used boolean not null default false,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint redeem_codes_used_at_check check (
    (is_used = false and used_at is null)
    or (is_used = true and used_at is not null)
  )
);

comment on table public.redeem_codes is 'Generated redemption codes for approved reward claims.';

drop trigger if exists set_redeem_codes_updated_at on public.redeem_codes;
create trigger set_redeem_codes_updated_at
before update on public.redeem_codes
for each row execute function public.set_updated_at();

-- =========================
-- Notifications and Audit Logs
-- =========================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type public.notification_type not null default 'system',
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.notifications is 'User-facing notifications for approvals, reminders, announcements, points, and system updates.';

drop trigger if exists set_notifications_updated_at on public.notifications;
create trigger set_notifications_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.profiles(id) on delete set null,
  action_type text not null,
  table_name text not null,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is 'Append-only audit trail for important admin actions.';

create table if not exists public.password_reset_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  email_hash text,
  activity_type text not null check (activity_type in ('request', 'completed', 'failed', 'rate_limited')),
  success boolean not null default true,
  detail text,
  created_at timestamptz not null default now()
);

comment on table public.password_reset_activity is 'Security audit log for password reset requests and completions. Email values are stored as hashes to reduce sensitive data exposure.';

-- Internal audit helper for RPCs. Admins can also insert audit logs directly through RLS.
create or replace function public.record_audit_log(
  p_action_type text,
  p_table_name text,
  p_record_id uuid default null,
  p_old_data jsonb default null,
  p_new_data jsonb default null,
  p_ip_address inet default null,
  p_user_agent text default null
)
returns public.audit_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  new_log public.audit_logs;
begin
  if not public.is_admin() then
    raise exception 'Only admins can create audit logs';
  end if;

  insert into public.audit_logs (
    admin_user_id,
    action_type,
    table_name,
    record_id,
    old_data,
    new_data,
    ip_address,
    user_agent
  )
  values (
    auth.uid(),
    p_action_type,
    p_table_name,
    p_record_id,
    p_old_data,
    p_new_data,
    p_ip_address,
    p_user_agent
  )
  returning * into new_log;

  return new_log;
end;
$$;

create or replace function public.log_password_reset_activity(
  p_email text default null,
  p_activity_type text default 'request',
  p_success boolean default true,
  p_detail text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text;
  hashed_email text;
  matched_user_id uuid;
  recent_requests integer;
begin
  if p_activity_type not in ('request', 'completed', 'failed', 'rate_limited') then
    raise exception 'Invalid password reset activity type';
  end if;

  normalized_email := lower(trim(coalesce(p_email, '')));

  if normalized_email = '' and auth.uid() is not null then
    select lower(trim(email)) into normalized_email
    from public.profiles
    where id = auth.uid();
  end if;

  if normalized_email <> '' then
    hashed_email := encode(digest(normalized_email, 'sha256'), 'hex');
    select id into matched_user_id
    from public.profiles
    where lower(trim(email)) = normalized_email
    limit 1;
  else
    matched_user_id := auth.uid();
  end if;

  if p_activity_type = 'request' and hashed_email is not null then
    select count(*)::integer into recent_requests
    from public.password_reset_activity
    where email_hash = hashed_email
      and activity_type in ('request', 'rate_limited')
      and created_at > now() - interval '1 hour';

    if recent_requests >= 5 then
      insert into public.password_reset_activity (user_id, email_hash, activity_type, success, detail)
      values (matched_user_id, hashed_email, 'rate_limited', false, 'Password reset request rate limit exceeded');
      raise exception 'Too many password reset requests. Please try again later.';
    end if;
  end if;

  insert into public.password_reset_activity (user_id, email_hash, activity_type, success, detail)
  values (coalesce(matched_user_id, auth.uid()), hashed_email, p_activity_type, p_success, p_detail);
end;
$$;

grant execute on function public.log_password_reset_activity(text, text, boolean, text) to anon, authenticated;

create or replace function public.create_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type public.notification_type default 'system'
)
returns public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  new_notification public.notifications;
begin
  if not public.is_admin() then
    raise exception 'Only admins can create notifications directly';
  end if;

  insert into public.notifications (user_id, title, message, type)
  values (p_user_id, p_title, p_message, p_type)
  returning * into new_notification;

  return new_notification;
end;
$$;

create or replace function public.notify_users_for_published_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'Published'
    and (tg_op = 'INSERT' or old.status is distinct from new.status)
  then
    insert into public.notifications (user_id, title, message, type)
    select
      p.id,
      'New post published',
      new.title,
      'announcement'
    from public.profiles p
    where p.role = 'user';
  end if;

  return new;
end;
$$;

drop trigger if exists notify_users_for_published_post_trigger on public.posts_or_announcements;
create trigger notify_users_for_published_post_trigger
after insert or update of status on public.posts_or_announcements
for each row execute function public.notify_users_for_published_post();

create or replace function public.admin_create_points_entry(
  p_user_id uuid,
  p_points integer,
  p_description text,
  p_entry_type public.points_entry_type default 'earned',
  p_event_id uuid default null
)
returns public.one_card_points
language plpgsql
security definer
set search_path = public
as $$
declare
  new_entry public.one_card_points;
begin
  if not public.is_admin() then
    raise exception 'Only admins can create points entries';
  end if;

  insert into public.one_card_points (user_id, entry_type, points, description, event_id, created_by)
  values (p_user_id, p_entry_type, p_points, p_description, p_event_id, auth.uid())
  returning * into new_entry;

  insert into public.notifications (user_id, title, message, type)
  values (
    p_user_id,
    case when p_points >= 0 then 'Points added' else 'Points updated' end,
    p_description || ' (' || p_points::text || ' pts)',
    'points'
  );

  return new_entry;
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_notification public.notifications;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.notifications
  set is_read = true
  where id = p_notification_id
    and (user_id = auth.uid() or public.is_admin())
  returning * into updated_notification;

  if updated_notification.id is null then
    raise exception 'Notification not found';
  end if;

  return updated_notification;
end;
$$;

create or replace function public.submit_reward_claim(p_reward_id uuid)
returns public.reward_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  reward_record public.rewards;
  current_balance integer;
  new_claim public.reward_claims;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into reward_record
  from public.rewards
  where id = p_reward_id
    and is_active = true;

  if reward_record.id is null then
    raise exception 'Reward is not available';
  end if;

  if reward_record.stock_quantity <= 0 then
    raise exception 'Reward is out of stock';
  end if;

  select coalesce(sum(points), 0)::integer into current_balance
  from public.one_card_points
  where user_id = auth.uid();

  if current_balance < reward_record.required_points then
    raise exception 'Insufficient points';
  end if;

  insert into public.reward_claims (user_id, reward_id, points_used)
  values (auth.uid(), reward_record.id, reward_record.required_points)
  returning * into new_claim;

  insert into public.notifications (user_id, title, message, type)
  values (
    auth.uid(),
    'Reward claim submitted',
    'Your claim for ' || reward_record.name || ' is now pending admin review.',
    'reward_claim'
  );

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
language plpgsql
security definer
set search_path = public
as $$
declare
  old_claim public.reward_claims;
  reward_record public.rewards;
  current_balance integer;
  generated_code text;
  updated_claim public.reward_claims;
begin
  if not public.is_admin() then
    raise exception 'Only admins can review reward claims';
  end if;

  if p_new_status not in ('Approved', 'Rejected') then
    raise exception 'Use Approved or Rejected for admin review';
  end if;

  select * into old_claim
  from public.reward_claims
  where id = p_claim_id
  for update;

  if old_claim.id is null then
    raise exception 'Reward claim not found';
  end if;

  if old_claim.claim_status <> 'Pending' then
    raise exception 'Only pending reward claims can be reviewed';
  end if;

  select * into reward_record
  from public.rewards
  where id = old_claim.reward_id
  for update;

  if p_new_status = 'Approved' then
    if reward_record.stock_quantity <= 0 then
      raise exception 'Reward is out of stock';
    end if;

    select coalesce(sum(points), 0)::integer into current_balance
    from public.one_card_points
    where user_id = old_claim.user_id;

    if current_balance < old_claim.points_used then
      raise exception 'User has insufficient points';
    end if;

    update public.rewards
    set stock_quantity = stock_quantity - 1
    where id = old_claim.reward_id;

    insert into public.one_card_points (user_id, entry_type, points, description, created_by)
    values (
      old_claim.user_id,
      'redeemed',
      -old_claim.points_used,
      'Reward redeemed: ' || reward_record.name,
      auth.uid()
    );
  end if;

  update public.reward_claims
  set
    claim_status = p_new_status,
    admin_notes = p_admin_notes,
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where id = p_claim_id
  returning * into updated_claim;

  if p_new_status = 'Approved' then
    loop
      generated_code := upper(substr(md5(random()::text || clock_timestamp()::text || p_claim_id::text), 1, 12));
      exit when not exists (
        select 1
        from public.redeem_codes
        where code = generated_code
      );
    end loop;

    insert into public.redeem_codes (claim_id, user_id, code, expires_at)
    values (p_claim_id, old_claim.user_id, generated_code, p_code_expires_at);

    perform public.create_notification(
      old_claim.user_id,
      'Reward claim approved',
      'Your reward claim was approved. A redeem code has been generated.',
      'reward_claim'
    );
  else
    perform public.create_notification(
      old_claim.user_id,
      'Reward claim rejected',
      coalesce(p_admin_notes, 'Your reward claim was rejected by an admin.'),
      'reward_claim'
    );
  end if;

  perform public.record_audit_log(
    'review_reward_claim',
    'reward_claims',
    p_claim_id,
    to_jsonb(old_claim),
    to_jsonb(updated_claim)
  );

  return updated_claim;
end;
$$;

create or replace function public.admin_mark_reward_claim_claimed(p_claim_id uuid)
returns public.reward_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  old_claim public.reward_claims;
  updated_claim public.reward_claims;
begin
  if not public.is_admin() then
    raise exception 'Only admins can mark rewards as claimed';
  end if;

  select * into old_claim
  from public.reward_claims
  where id = p_claim_id
  for update;

  if old_claim.id is null then
    raise exception 'Reward claim not found';
  end if;

  if old_claim.claim_status <> 'Approved' then
    raise exception 'Only approved reward claims can be marked as claimed';
  end if;

  update public.reward_claims
  set claim_status = 'Claimed', claimed_at = now()
  where id = p_claim_id
  returning * into updated_claim;

  update public.redeem_codes
  set is_used = true, used_at = now()
  where claim_id = p_claim_id;

  perform public.create_notification(
    old_claim.user_id,
    'Reward claimed',
    'Your approved reward has been marked as claimed.',
    'reward_claim'
  );

  perform public.record_audit_log(
    'mark_reward_claim_claimed',
    'reward_claims',
    p_claim_id,
    to_jsonb(old_claim),
    to_jsonb(updated_claim)
  );

  return updated_claim;
end;
$$;

-- =========================
-- Indexes
-- =========================

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists local_churches_district_idx on public.local_churches(district);
create index if not exists local_churches_active_idx on public.local_churches(is_active);

create index if not exists local_church_members_church_idx on public.local_church_members(local_church_id);
create index if not exists local_church_members_district_idx on public.local_church_members(local_church_id, activity_status);
create index if not exists local_church_members_activity_idx on public.local_church_members(activity_status);
create index if not exists local_church_members_review_idx on public.local_church_members(review_status);
create index if not exists local_church_members_submitted_by_idx on public.local_church_members(submitted_by);
create index if not exists local_church_members_birthday_idx on public.local_church_members(birthday);

create index if not exists member_review_logs_member_idx on public.member_review_logs(member_id);
create index if not exists events_status_date_idx on public.events(status, event_date);
create index if not exists event_evaluations_event_idx on public.event_evaluations(event_id);
create index if not exists event_evaluations_user_idx on public.event_evaluations(user_id, submitted_at desc);
create index if not exists event_evaluations_event_user_idx on public.event_evaluations(event_id, user_id);
create index if not exists event_evaluations_submitted_at_idx on public.event_evaluations(submitted_at desc);
create index if not exists evaluation_reward_history_user_idx on public.evaluation_reward_history(user_id, created_at desc);
create index if not exists evaluation_reward_history_event_idx on public.evaluation_reward_history(event_id, created_at desc);
create index if not exists image_submissions_status_idx on public.image_submissions(status);
create index if not exists image_submissions_submitted_by_idx on public.image_submissions(submitted_by);
create index if not exists one_card_points_user_idx on public.one_card_points(user_id, created_at desc);
create index if not exists one_card_redeem_codes_code_idx on public.one_card_redeem_codes(code);
create index if not exists one_card_redeem_codes_active_idx on public.one_card_redeem_codes(is_active, expires_at);
create index if not exists one_card_redeem_code_claims_code_idx on public.one_card_redeem_code_claims(redeem_code_id);
create index if not exists one_card_redeem_code_claims_user_idx on public.one_card_redeem_code_claims(user_id, claimed_at desc);
create index if not exists posts_status_published_idx on public.posts_or_announcements(status, published_at desc);
create index if not exists rewards_active_points_idx on public.rewards(is_active, required_points);
create index if not exists reward_claims_user_idx on public.reward_claims(user_id, created_at desc);
create index if not exists reward_claims_reward_idx on public.reward_claims(reward_id);
create index if not exists reward_claims_status_idx on public.reward_claims(claim_status);
create index if not exists redeem_codes_user_idx on public.redeem_codes(user_id, created_at desc);
create index if not exists redeem_codes_code_idx on public.redeem_codes(code);
create index if not exists redeem_codes_claim_idx on public.redeem_codes(claim_id);
create index if not exists notifications_user_read_idx on public.notifications(user_id, is_read, created_at desc);
create index if not exists notifications_type_idx on public.notifications(type);
create index if not exists audit_logs_admin_idx on public.audit_logs(admin_user_id, created_at desc);
create index if not exists audit_logs_table_record_idx on public.audit_logs(table_name, record_id);
create index if not exists audit_logs_action_idx on public.audit_logs(action_type, created_at desc);
create index if not exists password_reset_activity_email_idx on public.password_reset_activity(email_hash, created_at desc);
create index if not exists password_reset_activity_user_idx on public.password_reset_activity(user_id, created_at desc);
create index if not exists password_reset_activity_type_idx on public.password_reset_activity(activity_type, created_at desc);

-- =========================
-- RLS
-- =========================

alter table public.profiles enable row level security;
alter table public.local_churches enable row level security;
alter table public.local_church_members enable row level security;
alter table public.member_review_logs enable row level security;
alter table public.events enable row level security;
alter table public.event_evaluations enable row level security;
alter table public.evaluation_reward_history enable row level security;
alter table public.image_submissions enable row level security;
alter table public.one_card_points enable row level security;
alter table public.one_card_redeem_codes enable row level security;
alter table public.one_card_redeem_code_claims enable row level security;
alter table public.posts_or_announcements enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_claims enable row level security;
alter table public.redeem_codes enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.password_reset_activity enable row level security;

-- Profiles
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_admin_only" on public.profiles;
create policy "profiles_insert_admin_only"
on public.profiles for insert
to authenticated
with check (public.is_admin());

drop policy if exists "profiles_update_admin_only" on public.profiles;
create policy "profiles_update_admin_only"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "profiles_delete_admin_only" on public.profiles;
create policy "profiles_delete_admin_only"
on public.profiles for delete
to authenticated
using (public.is_admin());

-- Local churches
drop policy if exists "local_churches_select_authenticated" on public.local_churches;
create policy "local_churches_select_authenticated"
on public.local_churches for select
to authenticated
using (true);

drop policy if exists "local_churches_select_active_public" on public.local_churches;
create policy "local_churches_select_active_public"
on public.local_churches for select
to anon
using (is_active = true);

drop policy if exists "local_churches_admin_manage" on public.local_churches;
create policy "local_churches_admin_manage"
on public.local_churches for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Local church members
drop policy if exists "members_select_own_or_admin" on public.local_church_members;
create policy "members_select_own_or_admin"
on public.local_church_members for select
to authenticated
using (submitted_by = auth.uid() or public.is_admin());

drop policy if exists "members_insert_own" on public.local_church_members;
create policy "members_insert_own"
on public.local_church_members for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and review_status = 'Pending'
  and reviewed_by is null
  and reviewed_at is null
  and admin_notes is null
);

drop policy if exists "members_insert_admin" on public.local_church_members;
create policy "members_insert_admin"
on public.local_church_members for insert
to authenticated
with check (public.is_admin());

-- Direct user updates are intentionally not allowed.
-- Use update_my_member_application() so users cannot edit review fields.
drop policy if exists "members_update_admin_only" on public.local_church_members;
create policy "members_update_admin_only"
on public.local_church_members for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "members_delete_own_pending_or_admin" on public.local_church_members;
create policy "members_delete_own_pending_or_admin"
on public.local_church_members for delete
to authenticated
using (
  public.is_admin()
  or (submitted_by = auth.uid() and review_status = 'Pending')
);

-- Member review logs
drop policy if exists "member_review_logs_select_admin" on public.member_review_logs;
create policy "member_review_logs_select_admin"
on public.member_review_logs for select
to authenticated
using (public.is_admin());

drop policy if exists "member_review_logs_insert_admin" on public.member_review_logs;
create policy "member_review_logs_insert_admin"
on public.member_review_logs for insert
to authenticated
with check (public.is_admin());

-- Events
drop policy if exists "events_select_published_or_admin" on public.events;
create policy "events_select_published_or_admin"
on public.events for select
to authenticated
using (status in ('Published', 'Completed') or public.is_admin());

drop policy if exists "events_admin_manage" on public.events;
create policy "events_admin_manage"
on public.events for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Event evaluations
drop policy if exists "evaluations_select_own_or_admin" on public.event_evaluations;
create policy "evaluations_select_own_or_admin"
on public.event_evaluations for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "evaluations_insert_own" on public.event_evaluations;
create policy "evaluations_insert_own"
on public.event_evaluations for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.events e
    where e.id = event_id
      and e.status in ('Published', 'Completed')
      and e.evaluation_enabled = true
  )
);

drop policy if exists "evaluations_update_own_or_admin" on public.event_evaluations;
drop policy if exists "evaluations_update_admin_only" on public.event_evaluations;
create policy "evaluations_update_admin_only"
on public.event_evaluations for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "evaluations_delete_admin" on public.event_evaluations;
create policy "evaluations_delete_admin"
on public.event_evaluations for delete
to authenticated
using (public.is_admin());

drop policy if exists "evaluation_reward_history_select_own_or_admin" on public.evaluation_reward_history;
create policy "evaluation_reward_history_select_own_or_admin"
on public.evaluation_reward_history for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "evaluation_reward_history_insert_system" on public.evaluation_reward_history;

drop policy if exists "evaluation_reward_history_update_admin" on public.evaluation_reward_history;
create policy "evaluation_reward_history_update_admin"
on public.evaluation_reward_history for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Image submissions
drop policy if exists "image_submissions_select_own_approved_or_admin" on public.image_submissions;
create policy "image_submissions_select_own_approved_or_admin"
on public.image_submissions for select
to authenticated
using (submitted_by = auth.uid() or status = 'Approved' or public.is_admin());

drop policy if exists "image_submissions_insert_own" on public.image_submissions;
create policy "image_submissions_insert_own"
on public.image_submissions for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and status = 'Pending'
  and reviewed_by is null
  and reviewed_at is null
  and admin_notes is null
);

drop policy if exists "image_submissions_update_admin_only" on public.image_submissions;
create policy "image_submissions_update_admin_only"
on public.image_submissions for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "image_submissions_delete_own_pending_or_admin" on public.image_submissions;
create policy "image_submissions_delete_own_pending_or_admin"
on public.image_submissions for delete
to authenticated
using (
  public.is_admin()
  or (submitted_by = auth.uid() and status = 'Pending')
);

-- One card points
drop policy if exists "one_card_points_select_own_or_admin" on public.one_card_points;
create policy "one_card_points_select_own_or_admin"
on public.one_card_points for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "one_card_points_admin_insert" on public.one_card_points;
create policy "one_card_points_admin_insert"
on public.one_card_points for insert
to authenticated
with check (public.is_admin());

drop policy if exists "one_card_points_admin_update" on public.one_card_points;
create policy "one_card_points_admin_update"
on public.one_card_points for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "one_card_points_admin_delete" on public.one_card_points;
create policy "one_card_points_admin_delete"
on public.one_card_points for delete
to authenticated
using (public.is_admin());

drop policy if exists "one_card_redeem_codes_select_authenticated" on public.one_card_redeem_codes;
create policy "one_card_redeem_codes_select_authenticated"
on public.one_card_redeem_codes for select
to authenticated
using (public.is_admin() or (is_active = true and expires_at > now()));

drop policy if exists "one_card_redeem_codes_admin_insert" on public.one_card_redeem_codes;
create policy "one_card_redeem_codes_admin_insert"
on public.one_card_redeem_codes for insert
to authenticated
with check (public.is_admin());

drop policy if exists "one_card_redeem_codes_admin_update" on public.one_card_redeem_codes;
create policy "one_card_redeem_codes_admin_update"
on public.one_card_redeem_codes for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "one_card_redeem_codes_admin_delete" on public.one_card_redeem_codes;
create policy "one_card_redeem_codes_admin_delete"
on public.one_card_redeem_codes for delete
to authenticated
using (public.is_admin());

drop policy if exists "one_card_redeem_code_claims_select_own_or_admin" on public.one_card_redeem_code_claims;
create policy "one_card_redeem_code_claims_select_own_or_admin"
on public.one_card_redeem_code_claims for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "one_card_redeem_code_claims_admin_insert" on public.one_card_redeem_code_claims;
create policy "one_card_redeem_code_claims_admin_insert"
on public.one_card_redeem_code_claims for insert
to authenticated
with check (public.is_admin());

-- Posts and announcements
drop policy if exists "posts_select_published_or_admin" on public.posts_or_announcements;
create policy "posts_select_published_or_admin"
on public.posts_or_announcements for select
to authenticated
using (status = 'Published' or public.is_admin());

drop policy if exists "posts_admin_manage" on public.posts_or_announcements;
create policy "posts_admin_manage"
on public.posts_or_announcements for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Rewards
drop policy if exists "rewards_select_active_or_admin" on public.rewards;
create policy "rewards_select_active_or_admin"
on public.rewards for select
to authenticated
using (is_active = true or public.is_admin());

drop policy if exists "rewards_admin_manage" on public.rewards;
create policy "rewards_admin_manage"
on public.rewards for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Reward claims
drop policy if exists "reward_claims_select_own_or_admin" on public.reward_claims;
create policy "reward_claims_select_own_or_admin"
on public.reward_claims for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Users submit claims through submit_reward_claim() so points and stock are checked atomically.
drop policy if exists "reward_claims_admin_insert" on public.reward_claims;
create policy "reward_claims_admin_insert"
on public.reward_claims for insert
to authenticated
with check (public.is_admin());

drop policy if exists "reward_claims_admin_update" on public.reward_claims;
create policy "reward_claims_admin_update"
on public.reward_claims for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "reward_claims_admin_delete" on public.reward_claims;
create policy "reward_claims_admin_delete"
on public.reward_claims for delete
to authenticated
using (public.is_admin());

-- Redeem codes
drop policy if exists "redeem_codes_select_own_or_admin" on public.redeem_codes;
create policy "redeem_codes_select_own_or_admin"
on public.redeem_codes for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "redeem_codes_admin_insert" on public.redeem_codes;
create policy "redeem_codes_admin_insert"
on public.redeem_codes for insert
to authenticated
with check (public.is_admin());

drop policy if exists "redeem_codes_admin_update" on public.redeem_codes;
create policy "redeem_codes_admin_update"
on public.redeem_codes for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "redeem_codes_admin_delete" on public.redeem_codes;
create policy "redeem_codes_admin_delete"
on public.redeem_codes for delete
to authenticated
using (public.is_admin());

-- Notifications
drop policy if exists "notifications_select_own_or_admin" on public.notifications;
create policy "notifications_select_own_or_admin"
on public.notifications for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "notifications_admin_insert" on public.notifications;
create policy "notifications_admin_insert"
on public.notifications for insert
to authenticated
with check (public.is_admin());

-- Users mark notifications read through mark_notification_read() to avoid editing title/message/type.
drop policy if exists "notifications_admin_update" on public.notifications;
create policy "notifications_admin_update"
on public.notifications for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "notifications_admin_delete" on public.notifications;
create policy "notifications_admin_delete"
on public.notifications for delete
to authenticated
using (public.is_admin());

-- Audit logs
drop policy if exists "audit_logs_select_admin" on public.audit_logs;
create policy "audit_logs_select_admin"
on public.audit_logs for select
to authenticated
using (public.is_admin());

drop policy if exists "audit_logs_insert_admin" on public.audit_logs;
create policy "audit_logs_insert_admin"
on public.audit_logs for insert
to authenticated
with check (public.is_admin());

-- Audit logs are append-only: no update or delete policies.

-- Password reset activity
drop policy if exists "password_reset_activity_select_admin" on public.password_reset_activity;
create policy "password_reset_activity_select_admin"
on public.password_reset_activity for select
to authenticated
using (public.is_admin());

-- Password reset activity is written only through log_password_reset_activity().

-- =========================
-- Frontend-friendly Views
-- =========================

create or replace view public.local_church_members_with_church
with (security_invoker = true)
as
select
  m.id,
  m.submitted_by,
  m.name,
  m.birthday,
  date_part('year', age(current_date, m.birthday))::integer as computed_age,
  m.contact_number,
  m.gender,
  m.address,
  m.parent_guardian_name,
  m.emergency_contact,
  m.local_church_id,
  c.name as local_church_name,
  c.district,
  m.professing_member,
  m.confirmation_class_year,
  m.confirmation_class_status,
  m.activity_status,
  m.review_status,
  m.reviewed_by,
  m.reviewed_at,
  m.admin_notes,
  m.created_at,
  m.updated_at
from public.local_church_members m
join public.local_churches c on c.id = m.local_church_id;

comment on view public.local_church_members_with_church is 'Convenient frontend view with church name, district, and computed age.';

create or replace view public.one_card_point_balances
with (security_invoker = true)
as
select
  p.id as user_id,
  p.full_name,
  coalesce(sum(o.points), 0)::integer as points_balance
from public.profiles p
left join public.one_card_points o on o.user_id = p.id
group by p.id, p.full_name;

comment on view public.one_card_point_balances is 'Frontend view for current NELPAC One Card balance per user.';

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
  rc.updated_at
from public.reward_claims rc
join public.rewards r on r.id = rc.reward_id;

comment on view public.reward_claims_with_rewards is 'Frontend view for displaying claim history with reward details.';

create or replace view public.event_evaluation_details
with (security_invoker = true)
as
select
  ev.id,
  ev.event_id,
  e.title as event_title,
  e.event_date,
  ev.user_id,
  p.full_name as user_full_name,
  ev.overall_rating,
  ev.speaker_rating,
  ev.venue_rating,
  ev.program_rating,
  ev.comment,
  ev.submitted_at,
  ev.created_at,
  ev.updated_at
from public.event_evaluations ev
join public.events e on e.id = ev.event_id
join public.profiles p on p.id = ev.user_id;

comment on view public.event_evaluation_details is 'Frontend view for submitted evaluations with event and user display fields.';

create or replace view public.event_evaluation_analytics
with (security_invoker = true)
as
select
  e.id as event_id,
  e.title as event_title,
  e.event_date,
  count(ev.id)::integer as total_evaluations,
  round(avg(ev.overall_rating)::numeric, 2) as average_overall_rating,
  round(avg(ev.speaker_rating)::numeric, 2) as average_speaker_rating,
  round(avg(ev.venue_rating)::numeric, 2) as average_venue_rating,
  round(avg(ev.program_rating)::numeric, 2) as average_program_rating
from public.events e
left join public.event_evaluations ev on ev.event_id = e.id
group by e.id, e.title, e.event_date;

comment on view public.event_evaluation_analytics is 'Admin-friendly aggregate averages and response counts per event.';

create or replace view public.event_evaluation_rating_distribution
with (security_invoker = true)
as
select
  event_id,
  overall_rating as rating,
  count(*)::integer as response_count
from public.event_evaluations
group by event_id, overall_rating;

comment on view public.event_evaluation_rating_distribution is 'Rating distribution per event for charts and feedback analytics.';

-- RLS policies apply through the underlying tables for normal Supabase queries.

-- First admin bootstrap:
-- 1. Sign up normally through Supabase Auth or your frontend.
-- 2. In SQL Editor, run this once with your real admin email:
--    update public.profiles set role = 'admin' where email = 'admin@example.com';
