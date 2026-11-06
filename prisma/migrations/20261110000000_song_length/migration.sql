-- Track length from YouTube. Filled when a song is saved, and by the daily cron for songs picked before this.
ALTER TABLE "Song" ADD COLUMN "durationSeconds" INTEGER;
ALTER TABLE "Song" ADD COLUMN "durationCheckedAt" TIMESTAMP(3);
