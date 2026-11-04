-- Sample data so the dashboard has something to show. Safe to run more than once. Paste into the Neon SQL
-- Editor, or run: psql "$DATABASE_URL" -f prisma/demo-data.sql

INSERT INTO "Group" (id, name, slug, description, "websiteUrl", "instagramUrl", "updatedAt")
VALUES ('demo-group', 'Sur Sangam (demo)', 'sur-sangam-demo', 'Sample group for trying out the site.',
  'https://example.com', 'https://www.instagram.com/example', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "EventSeries" (id, "groupId", title, "venueName", "venueAddress", rounds, frequency,
  "startTime", "endTime", "firstDate", "singerPriceCents", "listenerPriceCents", "maxSingers", "zelleName", "zelleHandle", "updatedAt")
VALUES ('demo-series', 'demo-group', 'Saturday Night Sur', 'Fremont Community Hall', '3300 Capitol Ave, Fremont, CA',
  '[{"kind":"EITHER","slotMode":"PICK","theme":"90s Bollywood","themeRequired":true},
    {"kind":"EITHER","slotMode":"CHECKIN_ORDER","theme":null,"themeRequired":false}]',
  'WEEKLY', '19:00', '22:00',
  current_date + ((6 - extract(dow FROM current_date)::int + 7) % 7), -- next Saturday
  2000, 1000, 20, 'Sur Sangam', 'pay@example.com', now())
ON CONFLICT (id) DO NOTHING;

-- The next four Saturdays, 7 to 10 pm Pacific (stored in UTC, as Prisma expects). The first uses the
-- event's rounds; the others have their own, with a different theme for round 1.
INSERT INTO "EventDate" (id, "seriesId", "startsAt", "endsAt", overrides, rounds, "updatedAt")
SELECT 'demo-date-' || n, 'demo-series',
  ((d + time '19:00') AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'UTC',
  ((d + time '22:00') AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'UTC',
  CASE WHEN n = 1 THEN ARRAY[]::TEXT[] ELSE ARRAY['rounds'] END,
  CASE WHEN n = 1 THEN NULL ELSE jsonb_build_array(
    jsonb_build_object('kind', 'EITHER', 'slotMode', 'PICK',
      'theme', (ARRAY[NULL, 'R.D. Burman', 'Kishore Kumar', 'Duets'])[n], 'themeRequired', true),
    jsonb_build_object('kind', 'EITHER', 'slotMode', 'CHECKIN_ORDER', 'theme', NULL, 'themeRequired', false)
  ) END, now()
FROM generate_series(1, 4) AS n,
  LATERAL (SELECT (current_date + ((6 - extract(dow FROM current_date)::int + 7) % 7) + 7 * (n - 1))::date AS d) s
ON CONFLICT (id) DO NOTHING;
