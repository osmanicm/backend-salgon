CREATE OR REPLACE FUNCTION public.sync_availability_to_property()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    SELECT id INTO v_prop_id
      FROM public.properties
     WHERE lower(btrim(model)) = lower(btrim(NEW.model))
       AND lower(btrim(lot))   = lower(btrim(NEW.lot))
       AND deleted_at IS NULL
     LIMIT 1;

    IF v_prop_id IS NULL THEN
      INSERT INTO public.properties (code, title, price, location, status, model, lot, delivery_date, notes)
      VALUES (
        v_code, v_title, COALESCE(NEW.price, 0), COALESCE(NEW.desarrollo, ''),
        NEW.status::text::property_status, NEW.model, NEW.lot, NEW.delivery, NEW.notes
      )
      RETURNING id INTO v_prop_id;
    END IF;

    NEW.property_id := v_prop_id;
  ELSE
    UPDATE public.properties
       SET title         = v_title,
           price         = COALESCE(NEW.price, price),
           location      = COALESCE(NULLIF(NEW.desarrollo, ''), location),
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
$function$;