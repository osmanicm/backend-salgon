-- Auto-sync properties -> availability_units when model + lot are set
CREATE OR REPLACE FUNCTION public.sync_property_to_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip if no model or lot defined
  IF NEW.model IS NULL OR NEW.lot IS NULL OR btrim(NEW.model) = '' OR btrim(NEW.lot) = '' THEN
    RETURN NEW;
  END IF;

  -- Soft-deleted: remove its availability mirror
  IF NEW.deleted_at IS NOT NULL THEN
    DELETE FROM public.availability_units WHERE property_id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.availability_units (property_id, model, lot, price, delivery, status, notes)
  VALUES (
    NEW.id,
    NEW.model,
    NEW.lot,
    COALESCE(NEW.price, 0),
    NEW.delivery_date,
    NEW.status::text::availability_status,
    COALESCE(NEW.notes, '')
  )
  ON CONFLICT (property_id) DO UPDATE SET
    model = EXCLUDED.model,
    lot = EXCLUDED.lot,
    price = EXCLUDED.price,
    delivery = EXCLUDED.delivery,
    status = EXCLUDED.status,
    notes = EXCLUDED.notes,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Need unique constraint on property_id for ON CONFLICT
ALTER TABLE public.availability_units
  ADD CONSTRAINT availability_units_property_id_unique UNIQUE (property_id);

DROP TRIGGER IF EXISTS trg_sync_property_to_availability ON public.properties;
CREATE TRIGGER trg_sync_property_to_availability
AFTER INSERT OR UPDATE ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.sync_property_to_availability();

-- Backfill existing properties (model + lot defined, not deleted)
INSERT INTO public.availability_units (property_id, model, lot, price, delivery, status, notes)
SELECT id, model, lot, COALESCE(price, 0), delivery_date, status::text::availability_status, COALESCE(notes, '')
FROM public.properties
WHERE deleted_at IS NULL
  AND model IS NOT NULL AND btrim(model) <> ''
  AND lot IS NOT NULL AND btrim(lot) <> ''
ON CONFLICT (property_id) DO NOTHING;