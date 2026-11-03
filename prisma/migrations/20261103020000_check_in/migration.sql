-- In-person check-in: admins open check-in per date, guests scan a rotating QR code at the venue.
CREATE TYPE "CheckInMethod" AS ENUM ('SCAN', 'ADMIN');

ALTER TABLE "EventDate" ADD COLUMN "checkInOpenedAt" TIMESTAMP(3),
ADD COLUMN "checkInSecret" TEXT;

ALTER TABLE "SignUp" ADD COLUMN "checkedInAt" TIMESTAMP(3),
ADD COLUMN "checkInMethod" "CheckInMethod",
ADD COLUMN "checkedInById" TEXT;

ALTER TABLE "SignUp" ADD CONSTRAINT "SignUp_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
