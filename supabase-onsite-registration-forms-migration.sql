-- Onsite Registration form configuration and shared registration pipeline.
alter table public.events
  add column if not exists onsite_registration_enabled boolean not null default false,
  add column if not exists onsite_registration_mode text not null default 'Automatic',
  add column if not exists onsite_registration_slug text,
  add column if not exists onsite_registration_guide text not null default 'Registration must be filled out by one representative only, preferably the Local Church President.',
  add column if not exists onsite_registration_form_config jsonb not null default '{}'::jsonb;

do $$ begin
  alter table public.events add constraint events_onsite_registration_mode_check
    check (onsite_registration_mode in ('Manual', 'Automatic'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.events add constraint events_onsite_registration_config_object
    check (jsonb_typeof(onsite_registration_form_config) = 'object');
exception when duplicate_object then null;
end $$;

create unique index if not exists events_onsite_registration_slug_unique
on public.events (lower(onsite_registration_slug))
where onsite_registration_slug is not null;

alter table public.event_registrations
  add column if not exists registration_type text not null default 'Pre-Registration';

do $$ begin
  alter table public.event_registrations add constraint event_registration_type_check
    check (registration_type in ('Pre-Registration', 'Onsite'));
exception when duplicate_object then null;
end $$;

alter table public.event_registrations
  drop constraint if exists event_registrations_event_church_unique;
drop index if exists public.event_registrations_event_church_unique;
create unique index if not exists event_registrations_event_church_type_unique
on public.event_registrations(event_id, local_church_id, registration_type);

-- Onsite cash submissions intentionally have no uploaded payment proof.
alter table public.event_registration_supplements
  alter column proof_of_payment_url drop not null;

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
  else
    new.event_id := old.event_id;
    new.submitted_by := old.submitted_by;
    new.local_church_id := old.local_church_id;
    new.registration_type := old.registration_type;
    new.fee_per_delegate := old.fee_per_delegate;
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
      new.gcash_mode_of_payment := 'Cash';
      new.proof_of_payment_url := null;
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

  select * into event_record
  from public.events
  where id = parent_event_id;

  if event_record.id is null then raise exception 'Registration not found'; end if;

  if parent_type = 'Onsite' then
    if event_record.status <> 'Published'
      or not event_record.onsite_registration_enabled
      or (event_record.onsite_registration_mode = 'Automatic'
        and (now() at time zone 'Asia/Manila')::date < event_record.event_date)
    then raise exception 'Onsite registration is not open for this event'; end if;
    new.gcash_mode_of_payment := 'Cash';
    new.proof_of_payment_url := null;
  else
    if event_record.status <> 'Published' or not event_record.pre_registration_enabled
      or (event_record.registration_deadline is not null and now() > event_record.registration_deadline)
    then raise exception 'Pre-registration is not open for this event'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_event_supplement_availability
on public.event_registration_supplements;
create trigger validate_event_supplement_availability
before insert on public.event_registration_supplements
for each row execute function public.validate_event_registration_supplement_availability();

comment on column public.events.onsite_registration_enabled is 'Master switch for the onsite registration form.';
comment on column public.events.onsite_registration_mode is 'Manual opens immediately; Automatic opens on the event date.';
comment on column public.event_registrations.registration_type is 'Separates pre-registration and onsite church submissions.';
