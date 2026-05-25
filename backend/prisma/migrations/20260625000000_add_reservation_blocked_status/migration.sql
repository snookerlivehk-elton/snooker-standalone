DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'ReservationStatus'
      AND e.enumlabel = 'BLOCKED'
  ) THEN
    ALTER TYPE "ReservationStatus" ADD VALUE 'BLOCKED';
  END IF;
END$$;

