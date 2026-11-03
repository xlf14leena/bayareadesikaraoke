-- A duet can name another sign-up for the same date as the partner.
ALTER TABLE "Song" ADD COLUMN "duetPartnerId" TEXT;

ALTER TABLE "Song" ADD CONSTRAINT "Song_duetPartnerId_fkey" FOREIGN KEY ("duetPartnerId") REFERENCES "SignUp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
