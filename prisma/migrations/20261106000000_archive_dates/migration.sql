-- Admins can archive a past date so it's hidden from the group page's past karaoke nights.
ALTER TABLE "EventDate" ADD COLUMN "archivedAt" TIMESTAMP(3);
