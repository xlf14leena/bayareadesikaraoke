-- Themes live on each round now (rounds JSON, src/lib/rounds.ts), so the event and date theme
-- columns and the "theme" date override go.
ALTER TABLE "EventSeries" DROP COLUMN "theme", DROP COLUMN "themeRequired";
ALTER TABLE "EventDate" DROP COLUMN "theme", DROP COLUMN "themeRequired";
UPDATE "EventDate" SET "overrides" = array_remove("overrides", 'theme') WHERE 'theme' = ANY("overrides");
