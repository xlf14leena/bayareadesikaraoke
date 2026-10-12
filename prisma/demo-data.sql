-- Sample data so the dashboard has something to show. Safe to run more than once. Paste into the Neon SQL
-- Editor, or run: psql "$DATABASE_URL" -f prisma/demo-data.sql

INSERT INTO "Group" (id, name, slug, description, "zelleName", "zelleHandle", "updatedAt")
VALUES ('demo-group', 'Sur Sangam (demo)', 'sur-sangam-demo', 'Sample group for trying out the site.', 'Sur Sangam', 'pay@example.com', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "EventSeries" (id, "groupId", title, "venueName", "venueAddress", theme, frequency,
  "startTime", "endTime", "firstDate", "singerPriceCents", "listenerPriceCents", "maxSingers", "updatedAt")
VALUES ('demo-series', 'demo-group', 'Saturday Night Sur', 'Fremont Community Hall', '3300 Capitol Ave, Fremont, CA',
  '90s Bollywood', 'WEEKLY', '19:00', '22:00',
  current_date + ((6 - extract(dow FROM current_date)::int + 7) % 7), -- next Saturday
  2000, 1000, 20, now())
ON CONFLICT (id) DO NOTHING;

-- The next four Saturdays, 7 to 10 pm Pacific (stored in UTC, as Prisma expects).
INSERT INTO "EventDate" (id, "seriesId", "startsAt", "endsAt", theme, "singerPriceCents", "listenerPriceCents", "maxSingers", "updatedAt")
SELECT 'demo-date-' || n, 'demo-series',
  ((d + time '19:00') AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'UTC',
  ((d + time '22:00') AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'UTC',
  (ARRAY['90s Bollywood', 'R.D. Burman', 'Kishore Kumar', 'Duets'])[n], 2000, 1000, 20, now()
FROM generate_series(1, 4) AS n,
  LATERAL (SELECT (current_date + ((6 - extract(dow FROM current_date)::int + 7) % 7) + 7 * (n - 1))::date AS d) s
ON CONFLICT (id) DO NOTHING;
