-- NELPAC live updates and publication notifications migration.
-- Run after supabase-schema.sql and supabase-event-registration-merch-schema.sql.

-- Add every current application table to Supabase Realtime without failing
-- when this migration is run more than once.
do $$
declare
  target_table text;
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    raise exception 'The Supabase Realtime publication does not exist';
  end if;

  foreach target_table in array array[
    'profiles',
    'local_churches',
    'local_church_members',
    'events',
    'event_evaluations',
    'image_submissions',
    'one_card_points',
    'one_card_redeem_codes',
    'one_card_redeem_code_claims',
    'posts_or_announcements',
    'rewards',
    'reward_claims',
    'redeem_codes',
    'notifications',
    'event_registrations',
    'event_registration_delegates',
    'event_registration_supplements',
    'merch_preorder_forms',
    'merch_preorders',
    'merch_shirt_order_items',
    'merch_preorder_supplements'
  ]
  loop
    if to_regclass(format('public.%I', target_table)) is not null
      and not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = target_table
      )
    then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        target_table
      );
    end if;
  end loop;
end;
$$;

create or replace function public.notify_users_for_event_changes()
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
      profile.id,
      'New event published',
      new.title || ' is now available.',
      'announcement'
    from public.profiles profile
    where profile.role = 'user';
  end if;

  if new.pre_registration_enabled = true
    and new.status = 'Published'
    and (
      tg_op = 'INSERT'
      or old.pre_registration_enabled is distinct from new.pre_registration_enabled
    )
  then
    insert into public.notifications (user_id, title, message, type)
    select
      profile.id,
      'Event pre-registration opened',
      'Pre-registration for ' || new.title || ' is now open.',
      'event_reminder'
    from public.profiles profile
    where profile.role = 'user';
  end if;

  return new;
end;
$$;

drop trigger if exists notify_users_for_event_changes_trigger on public.events;
create trigger notify_users_for_event_changes_trigger
after insert or update of status, pre_registration_enabled on public.events
for each row execute function public.notify_users_for_event_changes();

create or replace function public.notify_users_for_published_merch_form()
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
      profile.id,
      'New merch pre-order available',
      new.title || ' is now open for pre-orders.',
      'announcement'
    from public.profiles profile
    where profile.role = 'user';
  end if;

  return new;
end;
$$;

drop trigger if exists notify_users_for_published_merch_form_trigger
on public.merch_preorder_forms;
create trigger notify_users_for_published_merch_form_trigger
after insert or update of status on public.merch_preorder_forms
for each row execute function public.notify_users_for_published_merch_form();

create or replace function public.notify_admins_for_event_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_title text;
  church_name text;
begin
  if new.submission_status = 'Submitted'
    and old.submission_status is distinct from new.submission_status
  then
    select event.title into event_title
    from public.events event
    where event.id = new.event_id;

    select church.name into church_name
    from public.local_churches church
    where church.id = new.local_church_id;

    insert into public.notifications (user_id, title, message, type)
    select
      profile.id,
      'New pre-registration submitted',
      coalesce(church_name, 'A local church') || ' submitted pre-registration for ' || coalesce(event_title, 'an event') || '.',
      'system'
    from public.profiles profile
    where profile.role = 'admin';
  end if;

  return new;
end;
$$;

drop trigger if exists notify_admins_for_event_registration_trigger
on public.event_registrations;
create trigger notify_admins_for_event_registration_trigger
after update of submission_status on public.event_registrations
for each row execute function public.notify_admins_for_event_registration();

create or replace function public.notify_admins_for_merch_preorder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  form_title text;
  church_name text;
begin
  if new.submission_status = 'Submitted'
    and old.submission_status is distinct from new.submission_status
  then
    select form.title into form_title
    from public.merch_preorder_forms form
    where form.id = new.form_id;

    select church.name into church_name
    from public.local_churches church
    where church.id = new.local_church_id;

    insert into public.notifications (user_id, title, message, type)
    select
      profile.id,
      'New merch pre-order submitted',
      coalesce(church_name, 'A local church') || ' submitted an order for ' || coalesce(form_title, 'a merch form') || '.',
      'system'
    from public.profiles profile
    where profile.role = 'admin';
  end if;

  return new;
end;
$$;

drop trigger if exists notify_admins_for_merch_preorder_trigger
on public.merch_preorders;
create trigger notify_admins_for_merch_preorder_trigger
after update of submission_status on public.merch_preorders
for each row execute function public.notify_admins_for_merch_preorder();

-- posts_or_announcements already uses notify_users_for_published_post_trigger
-- from supabase-schema.sql. Publishing posts will now also refresh every open
-- user session immediately through the Realtime publication above.
