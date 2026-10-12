-- The sample data script gave the demo series a first date of the day it ran,
-- while its dates fall on Saturdays. Date generation follows the series'
-- weekday, so move the first date to the demo's first Saturday. No-op when the
-- sample data isn't loaded.
UPDATE "EventSeries" s
SET "firstDate" = d.first_day
FROM (
  SELECT ("startsAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Los_Angeles')::date AS first_day
  FROM "EventDate"
  WHERE "seriesId" = 'demo-series'
  ORDER BY "startsAt"
  LIMIT 1
) d
WHERE s.id = 'demo-series';
