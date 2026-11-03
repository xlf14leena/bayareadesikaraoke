-- The running order's current singer: round and slot, set by an admin.
-- AlterTable
ALTER TABLE "EventDate" ADD COLUMN     "nowRound" INTEGER,
ADD COLUMN     "nowSlot" INTEGER;

