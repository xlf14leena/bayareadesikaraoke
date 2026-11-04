-- Zelle details move from the group to the event template (with a per-date override),
-- and groups get optional website, Facebook and Instagram links.
ALTER TABLE "EventSeries" ADD COLUMN "zelleName" TEXT, ADD COLUMN "zelleHandle" TEXT;
ALTER TABLE "EventDate" ADD COLUMN "zelleName" TEXT, ADD COLUMN "zelleHandle" TEXT;

-- Every existing event keeps the Zelle details its group had.
UPDATE "EventSeries" s
SET "zelleName" = g."zelleName", "zelleHandle" = g."zelleHandle"
FROM "Group" g
WHERE s."groupId" = g.id;

ALTER TABLE "Group" DROP COLUMN "zelleName", DROP COLUMN "zelleHandle";
ALTER TABLE "Group" ADD COLUMN "websiteUrl" TEXT, ADD COLUMN "facebookUrl" TEXT, ADD COLUMN "instagramUrl" TEXT;
