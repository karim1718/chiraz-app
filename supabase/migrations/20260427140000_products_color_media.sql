-- Photos par couleur : mapping JSON { "NomCouleur": ["url", ...], ... }
-- Les clés correspondent à variants.color (même libellé).

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS color_media jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.products.color_media IS 'URLs d''images par libellé de couleur (aligné sur variants.color).';

-- Backfill : pour chaque couleur distincte des variantes, copier le tableau images actuel du produit.
UPDATE public.products p
SET color_media = COALESCE(
  (
    SELECT jsonb_object_agg(c.color, to_jsonb(COALESCE(p.images, ARRAY[]::text[])))
    FROM (
      SELECT DISTINCT TRIM(v.color) AS color
      FROM public.variants v
      WHERE v.product_id = p.id
        AND v.color IS NOT NULL
        AND TRIM(v.color) <> ''
    ) c
  ),
  '{}'::jsonb
);
