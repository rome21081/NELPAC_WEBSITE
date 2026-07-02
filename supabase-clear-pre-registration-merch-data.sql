-- NELPAC Pre-Registration and Merch Pre-Order data cleanup
--
-- WARNING: This permanently removes ALL pre-registration and merch pre-order
-- forms, submissions, delegates, order items, payment references, and custom
-- form inputs from the database.
--
-- It preserves users, profiles, local churches, events, and the feature's
-- tables/functions/policies so new forms can be created afterward.
--
-- Run this file in the Supabase SQL Editor only after taking a backup.

begin;

-- Child records are removed first to keep the cleanup explicit and safe.
delete from public.event_registration_delegates;
delete from public.event_registrations;

-- The shirt-total trigger intentionally blocks changes to submitted orders.
-- Disable only this trigger during maintenance cleanup. Because this happens
-- inside the transaction, PostgreSQL restores it automatically on rollback.
alter table public.merch_shirt_order_items
  disable trigger sync_shirt_preorder_total_trigger;

delete from public.merch_shirt_order_items;
delete from public.merch_preorders;
delete from public.merch_preorder_forms;

alter table public.merch_shirt_order_items
  enable trigger sync_shirt_preorder_total_trigger;

-- Event pre-registration forms are stored as configuration on each event.
-- Reset those fields without deleting the event itself.
update public.events
set
  pre_registration_enabled = false,
  pre_registration_slug = null,
  registration_fee = 0,
  registration_deadline = null,
  registration_guide = 'Registration must be filled out by one representative only, preferably the Local Church President.',
  registration_form_config = '{}'::jsonb,
  registration_gcash_details = null,
  registration_gcash_recipient_name = null,
  registration_gcash_number = null;

commit;

-- This script clears database records only. Supabase Storage files in these
-- buckets must be removed separately through the Storage API or dashboard:
--   registration-payment-proofs
--   merch-payment-proofs
--   merch-images
