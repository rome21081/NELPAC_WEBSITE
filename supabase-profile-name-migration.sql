-- Safe profile-name compatibility migration.
-- Run this file once in the Supabase SQL Editor for an existing deployment.
-- Existing values are preserved and no names are guessed or split.

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists name text,
  add column if not exists name_completed boolean not null default false;

comment on column public.profiles.full_name is 'Normalized complete name saved from separate first, middle, and last name profile inputs.';
comment on column public.profiles.name is 'Legacy name value retained for backwards-compatible display fallback.';
comment on column public.profiles.name_completed is 'True only after the user submits all required profile details: first name, last name, and contact number. Existing users remain false until they update.';

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

  if p_full_name is not null
    and array_length(regexp_split_to_array(trim(regexp_replace(p_full_name, '\s+', ' ', 'g')), '\s+'), 1) < 2
  then
    raise exception 'Please enter your first name and last name before continuing';
  end if;

  if p_full_name is not null and nullif(trim(coalesce(p_contact_number, '')), '') is null then
    raise exception 'Please enter your contact number before continuing';
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
      and nullif(trim(coalesce(p_contact_number, contact_number, '')), '') is not null
    ),
    avatar_url = coalesce(p_avatar_url, avatar_url),
    contact_number = coalesce(p_contact_number, contact_number)
  where id = auth.uid()
  returning * into updated_profile;

  return updated_profile;
end;
$$;

create or replace view public.one_card_point_balances
with (security_invoker = true)
as
select
  profile.id as user_id,
  coalesce(nullif(trim(profile.full_name), ''), nullif(trim(profile.name), ''), 'No name provided.') as full_name,
  coalesce(sum(points.points), 0)::integer as points_balance
from public.profiles profile
left join public.one_card_points points on points.user_id = profile.id
group by profile.id, profile.full_name, profile.name;
