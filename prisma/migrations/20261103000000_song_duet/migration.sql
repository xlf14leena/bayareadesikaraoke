-- Singers mark each song as a solo or a duet.
ALTER TABLE "Song" ADD COLUMN "duet" BOOLEAN NOT NULL DEFAULT false;
