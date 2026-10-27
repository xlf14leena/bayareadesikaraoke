-- Event settings act as a template: a date uses the event's theme,
-- description, prices and caps unless an admin overrides them for that date.
-- "overrides" lists which settings this date sets itself.
ALTER TABLE "EventDate" ADD COLUMN "description" TEXT,
  ADD COLUMN "overrides" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN "singerPriceCents" DROP NOT NULL,
  ALTER COLUMN "listenerPriceCents" DROP NOT NULL;

-- Dates used to hold copies of the event's settings. Keep the ones an admin
-- changed as overrides; the rest now follow the event.
UPDATE "EventDate" d
SET "overrides" = array_remove(ARRAY[
    CASE WHEN d."theme" IS DISTINCT FROM s."theme" OR d."themeRequired" <> s."themeRequired" THEN 'theme' END,
    CASE WHEN d."singerPriceCents" <> s."singerPriceCents" OR d."listenerPriceCents" <> s."listenerPriceCents" THEN 'pricing' END,
    CASE WHEN d."maxSingers" IS DISTINCT FROM s."maxSingers" OR d."maxListeners" IS DISTINCT FROM s."maxListeners" THEN 'capacity' END
  ], NULL)
FROM "EventSeries" s
WHERE d."seriesId" = s."id";

-- Clear the copies that aren't overrides.
UPDATE "EventDate" SET "theme" = NULL, "themeRequired" = true WHERE NOT ('theme' = ANY("overrides"));
UPDATE "EventDate" SET "singerPriceCents" = NULL, "listenerPriceCents" = NULL WHERE NOT ('pricing' = ANY("overrides"));
UPDATE "EventDate" SET "maxSingers" = NULL, "maxListeners" = NULL WHERE NOT ('capacity' = ANY("overrides"));
