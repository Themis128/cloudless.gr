-- Migration: Fix mutable search_path for functions

-- Example for public.update_updated_at_column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_updated_at_column'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    EXECUTE $m$
      ALTER FUNCTION public.update_updated_at_column()
      SET search_path = 'public';
    $m$;
  END IF;
END$$;

-- Example for pg_temp_19.pg_get_collider
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'pg_get_collider'
      AND pronamespace = 'pg_temp_19'::regnamespace
  ) THEN
    EXECUTE $m$
      ALTER FUNCTION pg_temp_19.pg_get_collider()
      SET search_path = 'public';
    $m$;
  END IF;
END$$;

-- Example for pg_temp_19.pg_get_tabledef
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'pg_get_tabledef'
      AND pronamespace = 'pg_temp_19'::regnamespace
  ) THEN
    EXECUTE $m$
      ALTER FUNCTION pg_temp_19.pg_get_tabledef()
      SET search_path = 'public';
    $m$;
  END IF;
END$$;
