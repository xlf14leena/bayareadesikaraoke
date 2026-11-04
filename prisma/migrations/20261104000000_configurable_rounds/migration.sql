-- Configurable rounds: an event (and optionally a date) sets how many rounds
-- there are, and for each one solo/duet/either and its singing-order mode.
-- Existing events keep their two rounds and their slot modes.

ALTER TABLE "EventSeries" ADD COLUMN "rounds" JSONB NOT NULL DEFAULT '[{"kind":"EITHER","slotMode":"PICK"},{"kind":"EITHER","slotMode":"CHECKIN_ORDER"}]';

UPDATE "EventSeries" SET "rounds" = jsonb_build_array(
  jsonb_build_object('kind', 'EITHER', 'slotMode', "round1SlotMode"::text),
  jsonb_build_object('kind', 'EITHER', 'slotMode', "round2SlotMode"::text)
);

ALTER TABLE "EventSeries" DROP COLUMN "round1SlotMode",
DROP COLUMN "round2SlotMode";

-- A date's own rounds, used when its overrides list "rounds".
ALTER TABLE "EventDate" ADD COLUMN "rounds" JSONB;

-- Songs can be in any round the event has, not just 1 or 2.
ALTER TABLE "Song" DROP CONSTRAINT "Song_round_check";
ALTER TABLE "Song" ADD CONSTRAINT "Song_round_check" CHECK ("round" >= 1);
