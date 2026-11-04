-- Themes move from the event (and date) onto each round, inside the rounds JSON
-- (src/lib/rounds.ts). The old theme columns, and "theme" in date overrides, stay for now
-- but are no longer read, so a site still running the previous code shows the same themes.

-- Events: every round gets the event's theme.
UPDATE "EventSeries" s
SET "rounds" = (
  SELECT jsonb_agg(r || jsonb_build_object('theme', s."theme", 'themeRequired', s."themeRequired") ORDER BY i)
  FROM jsonb_array_elements(s."rounds") WITH ORDINALITY AS e(r, i)
)
WHERE s."theme" IS NOT NULL AND btrim(s."theme") <> '' AND jsonb_typeof(s."rounds") = 'array';

-- Dates with their own theme: they now keep their own rounds, each with the date's theme
-- (or no theme, when the date had turned it off).
UPDATE "EventDate" d
SET "rounds" = (
    SELECT jsonb_agg(
      r || jsonb_build_object(
        'theme', NULLIF(btrim(d."theme"), ''),
        'themeRequired', NULLIF(btrim(d."theme"), '') IS NOT NULL AND d."themeRequired"
      ) ORDER BY i)
    FROM jsonb_array_elements(
      CASE WHEN 'rounds' = ANY(d."overrides") AND d."rounds" IS NOT NULL THEN d."rounds" ELSE s."rounds" END
    ) WITH ORDINALITY AS e(r, i)
  ),
  "overrides" = array_append(array_remove(d."overrides", 'rounds'), 'rounds')
FROM "EventSeries" s
WHERE s."id" = d."seriesId" AND 'theme' = ANY(d."overrides");
