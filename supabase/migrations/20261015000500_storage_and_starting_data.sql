-- =============================================================================
-- Phase 1 · File 5 of 5 · Storage buckets and starting data
--
-- Starting data here is real configuration from BUILD_SPEC (the single shop
-- settings row and the starting category list). It is NOT sample data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Storage buckets
--   product-photos: public read (shown on product tiles), owner uploads.
--   invoices: private. Staff upload into a folder named after their user id
--             ("<user-id>/<file>.jpg"). Uploader and owner can view.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-photos', 'product-photos', true,  524288,  array['image/jpeg', 'image/png', 'image/webp']),
  ('invoices',       'invoices',       false, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

create policy "Staff list product photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'product-photos' and (select public.is_staff()));

create policy "Owner uploads product photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-photos' and (select public.is_owner()));

create policy "Owner replaces product photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-photos' and (select public.is_owner()))
  with check (bucket_id = 'product-photos' and (select public.is_owner()));

create policy "Owner removes product photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-photos' and (select public.is_owner()));

create policy "Staff upload invoices to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'invoices'
    and (select public.is_staff())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Owner and uploader view invoices"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'invoices'
    and (
      (select public.is_owner())
      or ((select public.is_staff()) and (storage.foldername(name))[1] = (select auth.uid())::text)
    )
  );
-- No update/delete policies on invoices: invoice photos are evidence.

-- -----------------------------------------------------------------------------
-- Starting data
-- -----------------------------------------------------------------------------
insert into public.shop_settings (shop_name, location)
values ('Koprice Enterprise', 'Esreso Ophilia');

insert into public.categories (name, sort_order)
values
  ('Water',                  10),
  ('Soft Drinks & Juices',   20),
  ('Alcoholic Drinks',       30),
  ('Canned Foods',           40),
  ('Provisions',             50),
  ('Toiletries & Soaps',     60),
  ('Detergents',             70),
  ('Polythene & Packaging',  80),
  ('Snacks & Biscuits',      90),
  ('Household',             100);
