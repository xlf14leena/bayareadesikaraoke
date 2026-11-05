-- A named duet partner now accepts or declines. Duets that already name a partner count as accepted,
-- so nothing changes for songs picked before this.
CREATE TYPE "DuetStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

ALTER TABLE "Song" ADD COLUMN "duetStatus" "DuetStatus";

UPDATE "Song" SET "duetStatus" = 'ACCEPTED' WHERE "duetPartnerId" IS NOT NULL;
