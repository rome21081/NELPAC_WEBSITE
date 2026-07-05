-- Admin-managed onsite event participants used by the Delegates workspace.
create table if not exists public.onsite_event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  local_church_id uuid references public.local_churches(id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  participant_role text not null default 'Delegate'
    check (participant_role in ('Delegate', 'Staff', 'Officer', 'Worker')),
  age integer check (age between 0 and 120),
  gender public.gender_type,
  contact_number text,
  notes text,
  registered_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onsite_delegate_details_check check (
    participant_role <> 'Delegate' or (age is not null and gender in ('Male', 'Female'))
  )
);

create index if not exists onsite_event_participants_event_idx
on public.onsite_event_participants(event_id);
create index if not exists onsite_event_participants_church_idx
on public.onsite_event_participants(local_church_id);

drop trigger if exists set_onsite_event_participants_updated_at
on public.onsite_event_participants;
create trigger set_onsite_event_participants_updated_at
before update on public.onsite_event_participants
for each row execute function public.set_updated_at();

alter table public.onsite_event_participants enable row level security;

drop policy if exists "onsite_participants_admin_manage"
on public.onsite_event_participants;
create policy "onsite_participants_admin_manage"
on public.onsite_event_participants for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, update, delete on public.onsite_event_participants to authenticated;
