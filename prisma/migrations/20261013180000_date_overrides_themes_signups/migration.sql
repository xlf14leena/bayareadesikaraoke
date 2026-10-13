-- Per-date delete and reschedule, optional or required themes, and an
-- admin switch that opens sign-ups for a date.
ALTER TYPE "EventDateStatus" ADD VALUE 'DELETED';

ALTER TABLE "EventSeries" ALTER COLUMN "theme" DROP NOT NULL,
  ADD COLUMN "themeRequired" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "EventDate" ALTER COLUMN "theme" DROP NOT NULL,
  ADD COLUMN "themeRequired" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "originalStartsAt" TIMESTAMP(3),
  ADD COLUMN "signupsOpen" BOOLEAN NOT NULL DEFAULT false;
