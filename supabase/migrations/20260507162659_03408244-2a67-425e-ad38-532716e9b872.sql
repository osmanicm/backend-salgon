
-- 1. Drop the old property→availability sync (we are inverting the direction)
DROP FUNCTION IF EXISTS public.sync_property_to_availability() CASCADE;

-- 2. Ensure model+lot is unique in availability (each lote is a unique sellable unit)
CREATE UNIQUE INDEX IF NOT EXISTS availability_units_model_lot_uniq
  ON public.availability_units (lower(btrim(model)), lower(btrim(lot)))
  WHERE model IS NOT NULL AND lot IS NOT NULL;

-- 3. New trigger: availability_units → properties (single source of truth)
CREATE OR REPLACE FUNCTION public.sync_availability_to_property()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_title text;
  v_prop_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.property_id IS NOT NULL THEN
      UPDATE public.properties
         SET deleted_at = now()
       WHERE id = OLD.property_id AND deleted_at IS NULL;
    END IF;
    RETURN OLD;
  END IF;

  v_code  := upper(btrim(NEW.model)) || '-L' || btrim(NEW.lot);
  v_title := btrim(NEW.model) || ' Lote ' || btrim(NEW.lot);

  IF NEW.property_id IS NULL THEN
    -- Try to find existing matching property (by model+lot)
    SELECT id INTO v_prop_id
      FROM public.properties
     WHERE lower(btrim(model)) = lower(btrim(NEW.model))
       AND lower(btrim(lot))   = lower(btrim(NEW.lot))
       AND deleted_at IS NULL
     LIMIT 1;

    IF v_prop_id IS NULL THEN
      INSERT INTO public.properties (code, title, price, location, status, model, lot, delivery_date, notes)
      VALUES (
        v_code, v_title, COALESCE(NEW.price, 0), COALESCE(NEW.cluster, ''),
        NEW.status::text::property_status, NEW.model, NEW.lot, NEW.delivery, NEW.notes
      )
      RETURNING id INTO v_prop_id;
    END IF;

    NEW.property_id := v_prop_id;
  ELSE
    UPDATE public.properties
       SET title         = v_title,
           price         = COALESCE(NEW.price, price),
           location      = COALESCE(NULLIF(NEW.cluster, ''), location),
           status        = NEW.status::text::property_status,
           model         = NEW.model,
           lot           = NEW.lot,
           delivery_date = NEW.delivery,
           notes         = NEW.notes,
           deleted_at    = NULL
     WHERE id = NEW.property_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_availability_to_property ON public.availability_units;
CREATE TRIGGER trg_sync_availability_to_property
BEFORE INSERT OR UPDATE OR DELETE ON public.availability_units
FOR EACH ROW EXECUTE FUNCTION public.sync_availability_to_property();

-- Re-attach status history trigger
DROP TRIGGER IF EXISTS trg_log_availability_status ON public.availability_units;
CREATE TRIGGER trg_log_availability_status
AFTER UPDATE ON public.availability_units
FOR EACH ROW EXECUTE FUNCTION public.log_availability_status_change();

-- updated_at
DROP TRIGGER IF EXISTS trg_availability_updated_at ON public.availability_units;
CREATE TRIGGER trg_availability_updated_at
BEFORE UPDATE ON public.availability_units
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_properties_updated_at ON public.properties;
CREATE TRIGGER trg_properties_updated_at
BEFORE UPDATE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Open availability CRUD to all authenticated users (was admin-only)
DROP POLICY IF EXISTS "Availability: admins insert" ON public.availability_units;
DROP POLICY IF EXISTS "Availability: admins update" ON public.availability_units;
DROP POLICY IF EXISTS "Availability: admins delete" ON public.availability_units;

CREATE POLICY "Availability: authenticated insert"
  ON public.availability_units FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Availability: authenticated update"
  ON public.availability_units FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Availability: authenticated delete"
  ON public.availability_units FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 5. Backfill: create availability_units from properties that have model+lot but no link
INSERT INTO public.availability_units (property_id, model, lot, cluster, price, delivery, status, notes)
SELECT p.id, p.model, p.lot, COALESCE(p.location, ''), COALESCE(p.price, 0), p.delivery_date,
       p.status::text::availability_status, COALESCE(p.notes, '')
  FROM public.properties p
 WHERE p.deleted_at IS NULL
   AND p.model IS NOT NULL AND btrim(p.model) <> ''
   AND p.lot   IS NOT NULL AND btrim(p.lot)   <> ''
   AND NOT EXISTS (
     SELECT 1 FROM public.availability_units au WHERE au.property_id = p.id
   );

-- 6. Soft-delete orphan properties (no model/lot → not a real lote)
UPDATE public.properties
   SET deleted_at = now()
 WHERE deleted_at IS NULL
   AND (model IS NULL OR btrim(model) = '' OR lot IS NULL OR btrim(lot) = '');
