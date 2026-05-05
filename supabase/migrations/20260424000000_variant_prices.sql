-- Migration: Add price and original_price to variants table

ALTER TABLE public.variants
ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) NULL,
ADD COLUMN IF NOT EXISTS original_price NUMERIC(10, 2) NULL;

-- Description:
-- `price` represents a variant-specific price. If NULL, the product's base price is used.
-- `original_price` represents the crossed-out price for this variant to indicate a discount.
