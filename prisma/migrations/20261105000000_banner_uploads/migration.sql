-- Banner images admins upload, served at /api/banners/<id>.
CREATE TABLE "BannerImage" (
    "id" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BannerImage_pkey" PRIMARY KEY ("id")
);

-- The banner is now a "Change for this date" setting. Dates that already
-- have their own banner link keep it.
UPDATE "EventDate" SET "overrides" = array_append("overrides", 'banner')
WHERE "bannerUrl" IS NOT NULL AND NOT ('banner' = ANY("overrides"));
