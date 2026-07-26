-- NELPAC merch pre-order forms and orders cleanup
--
-- WARNING: THIS IS A DESTRUCTIVE DATA-CLEANUP SCRIPT.
-- Run it in the Supabase SQL Editor only after creating a database backup.
--
-- Permanently removes:
--   1. All merchandise pre-order forms
--   2. All merchandise pre-orders submitted under those forms
--   3. Shirt order items and supplemental merch orders
--   4. Notifications and audit rows directly associated with merch pre-orders
--
-- Preserves:
--   - Users, profiles, churches, members, events, registrations, and rewards
--   - Posts and announcements
--   - Supabase table structure, functions, triggers, RLS policies, and storage buckets
--
-- Notes:
--   - Deleting public.merch_preorder_forms cascades to public.merch_preorders.
--   - Deleting public.merch_preorders cascades to shirt items and supplements.
--   - Linked reward rows are preserved; their merch_form_id becomes null because
--     the rewards migration uses ON DELETE SET NULL.

begin;

-- Submitted shirt orders normally reject item recalculation in the SQL Editor
-- because auth.uid() is not available. Pause only this maintenance trigger.
do $$
begin
  if to_regclass('public.merch_shirt_order_items') is not null
     and exists (
       select 1
       from pg_trigger
       where tgrelid = to_regclass('public.merch_shirt_order_items')
         and tgname = 'sync_shirt_preorder_total_trigger'
         and not tgisinternal
     ) then
    execute 'alter table public.merch_shirt_order_items disable trigger sync_shirt_preorder_total_trigger';
  end if;
end
$$;

-- Remove child records explicitly first. This keeps the cleanup readable and
-- also makes the script safe for databases where cascade behavior changed.
do $$
begin
  if to_regclass('public.merch_preorder_supplements') is not null then
    execute 'delete from public.merch_preorder_supplements';
  end if;

  if to_regclass('public.merch_shirt_order_items') is not null then
    execute 'delete from public.merch_shirt_order_items';
  end if;

  if to_regclass('public.merch_preorders') is not null then
    execute 'delete from public.merch_preorders';
  end if;

  if to_regclass('public.merch_preorder_forms') is not null then
    execute 'delete from public.merch_preorder_forms';
  end if;
end
$$;

do $$
begin
  if to_regclass('public.merch_shirt_order_items') is not null
     and exists (
       select 1
       from pg_trigger
       where tgrelid = to_regclass('public.merch_shirt_order_items')
         and tgname = 'sync_shirt_preorder_total_trigger'
         and not tgisinternal
     ) then
    execute 'alter table public.merch_shirt_order_items enable trigger sync_shirt_preorder_total_trigger';
  end if;
end
$$;

-- Remove merch-preorder notifications created by the supplement workflow.
do $$
begin
  if to_regclass('public.notifications') is not null then
    execute $sql$
      delete from public.notifications
      where title = 'Additional merch pre-order submitted'
         or type::text in ('merch_preorder', 'merch_preorder_supplement')
    $sql$;
  end if;
end
$$;

-- Remove matching audit-log records without touching unrelated history.
do $$
begin
  if to_regclass('public.audit_logs') is not null then
    execute $sql$
      delete from public.audit_logs
      where table_name in (
        'merch_preorder_forms',
        'merch_preorders',
        'merch_shirt_order_items',
        'merch_preorder_supplements'
      )
    $sql$;
  end if;
end
$$;

commit;

-- SQL removes database rows only. Delete uploaded files separately from these
-- Supabase Storage buckets if old files must also be erased:
--   - merch-payment-proofs
--   - merch-images
--
-- Suggested post-run checks:
-- select count(*) from public.merch_preorder_forms;
-- select count(*) from public.merch_preorders;
-- select count(*) from public.merch_shirt_order_items;
-- select count(*) from public.merch_preorder_supplements;
-- select count(*) from public.rewards;
-- select count(*) from public.events;
-- select count(*) from public.posts_or_announcements;
