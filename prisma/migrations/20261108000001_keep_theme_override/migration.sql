-- An earlier version of 20261108000000_themes_per_round also removed "theme" from date overrides,
-- which made the previous code show the event's theme on dates that had their own. Put it back
-- wherever a date still has its own theme. Does nothing when that version never ran.
UPDATE "EventDate"
SET "overrides" = array_append("overrides", 'theme')
WHERE "theme" IS NOT NULL AND btrim("theme") <> '' AND NOT ('theme' = ANY("overrides"));
