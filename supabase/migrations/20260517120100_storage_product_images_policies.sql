-- Storage : bucket product-images — lecture publique, écriture admin uniquement.

DROP POLICY IF EXISTS "chiraz_product_images_public_read" ON storage.objects;
CREATE POLICY "chiraz_product_images_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "chiraz_product_images_admin_insert" ON storage.objects;
CREATE POLICY "chiraz_product_images_admin_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_chiraz_admin()
  );

DROP POLICY IF EXISTS "chiraz_product_images_admin_update" ON storage.objects;
CREATE POLICY "chiraz_product_images_admin_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.is_chiraz_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_chiraz_admin());

DROP POLICY IF EXISTS "chiraz_product_images_admin_delete" ON storage.objects;
CREATE POLICY "chiraz_product_images_admin_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.is_chiraz_admin());
