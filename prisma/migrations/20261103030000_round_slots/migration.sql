-- Singing slots: a checked-in singer's place in each round, picked or given in check-in order.
-- CreateEnum
CREATE TYPE "SlotMode" AS ENUM ('PICK', 'CHECKIN_ORDER');

-- AlterTable
ALTER TABLE "EventSeries" ADD COLUMN     "round1SlotMode" "SlotMode" NOT NULL DEFAULT 'PICK',
ADD COLUMN     "round2SlotMode" "SlotMode" NOT NULL DEFAULT 'CHECKIN_ORDER';

-- CreateTable
CREATE TABLE "RoundSlot" (
    "eventDateId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "signUpId" TEXT NOT NULL,
    "method" "SlotMode" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoundSlot_pkey" PRIMARY KEY ("eventDateId","round","slot")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoundSlot_signUpId_round_key" ON "RoundSlot"("signUpId", "round");

-- AddForeignKey
ALTER TABLE "RoundSlot" ADD CONSTRAINT "RoundSlot_eventDateId_fkey" FOREIGN KEY ("eventDateId") REFERENCES "EventDate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundSlot" ADD CONSTRAINT "RoundSlot_signUpId_fkey" FOREIGN KEY ("signUpId") REFERENCES "SignUp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

