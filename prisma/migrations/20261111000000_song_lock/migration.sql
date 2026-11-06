-- When singers can no longer change songs or duet partners: per round as it starts (the default),
-- when check-in opens, or at the start time. Dates can override it.
CREATE TYPE "SongLock" AS ENUM ('ROUND_START', 'CHECK_IN', 'EVENT_START');
ALTER TABLE "EventSeries" ADD COLUMN "songLock" "SongLock" NOT NULL DEFAULT 'ROUND_START';
ALTER TABLE "EventDate" ADD COLUMN "songLock" "SongLock";
ALTER TABLE "EventDate" ADD COLUMN "songsLockedThrough" INTEGER NOT NULL DEFAULT 0;
-- Dates already under way: rounds that were started count as locked.
UPDATE "EventDate" SET "songsLockedThrough" = "nowRound" WHERE "nowRound" IS NOT NULL;
