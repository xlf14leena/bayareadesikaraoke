-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('ONCE', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "EventDateStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendeeRole" AS ENUM ('SINGER', 'LISTENER');

-- CreateEnum
CREATE TYPE "SignUpStatus" AS ENUM ('WAITLISTED', 'RESERVED', 'UNDER_REVIEW', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SongStatus" AS ENUM ('ACTIVE', 'REJECTED', 'RELEASED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "isSuperUser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "bannerUrl" TEXT,
    "zelleName" TEXT,
    "zelleHandle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupAdmin" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupAdmin_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateTable
CREATE TABLE "EventSeries" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "venueName" TEXT NOT NULL,
    "venueAddress" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "privateToken" TEXT,
    "frequency" "Frequency" NOT NULL DEFAULT 'ONCE',
    "monthlyWeekOfMonth" INTEGER,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "firstDate" DATE NOT NULL,
    "endDate" DATE,
    "singerPriceCents" INTEGER NOT NULL DEFAULT 0,
    "listenerPriceCents" INTEGER NOT NULL DEFAULT 0,
    "maxSingers" INTEGER,
    "maxListeners" INTEGER,
    "bannerUrl" TEXT,
    "signupOpensHoursBefore" INTEGER,
    "signupClosesHoursBefore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventDate" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "theme" TEXT NOT NULL,
    "singerPriceCents" INTEGER NOT NULL,
    "listenerPriceCents" INTEGER NOT NULL,
    "maxSingers" INTEGER,
    "maxListeners" INTEGER,
    "bannerUrl" TEXT,
    "signupOpensAt" TIMESTAMP(3),
    "signupClosesAt" TIMESTAMP(3),
    "status" "EventDateStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignUp" (
    "id" TEXT NOT NULL,
    "eventDateId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "role" "AttendeeRole" NOT NULL,
    "status" "SignUpStatus" NOT NULL DEFAULT 'RESERVED',
    "memoCode" TEXT NOT NULL,
    "amountDueCents" INTEGER NOT NULL,
    "screenshotKey" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reservedUntil" TIMESTAMP(3),
    "waitlistedAt" TIMESTAMP(3),
    "addedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "paymentNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Song" (
    "id" TEXT NOT NULL,
    "signUpId" TEXT NOT NULL,
    "eventDateId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "artist" TEXT,
    "youtubeUrl" TEXT,
    "youtubeVideoId" TEXT,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "status" "SongStatus" NOT NULL DEFAULT 'ACTIVE',
    "rejectReason" TEXT,

    CONSTRAINT "Song_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Group_slug_key" ON "Group"("slug");

-- CreateIndex
CREATE INDEX "GroupAdmin_userId_idx" ON "GroupAdmin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventSeries_privateToken_key" ON "EventSeries"("privateToken");

-- CreateIndex
CREATE INDEX "EventSeries_groupId_idx" ON "EventSeries"("groupId");

-- CreateIndex
CREATE INDEX "EventDate_startsAt_idx" ON "EventDate"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventDate_seriesId_startsAt_key" ON "EventDate"("seriesId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "SignUp_memoCode_key" ON "SignUp"("memoCode");

-- CreateIndex
CREATE INDEX "SignUp_eventDateId_status_idx" ON "SignUp"("eventDateId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SignUp_eventDateId_userId_key" ON "SignUp"("eventDateId", "userId");

-- CreateIndex
CREATE INDEX "Song_eventDateId_enteredAt_idx" ON "Song"("eventDateId", "enteredAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupAdmin" ADD CONSTRAINT "GroupAdmin_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupAdmin" ADD CONSTRAINT "GroupAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSeries" ADD CONSTRAINT "EventSeries_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDate" ADD CONSTRAINT "EventDate_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "EventSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignUp" ADD CONSTRAINT "SignUp_eventDateId_fkey" FOREIGN KEY ("eventDateId") REFERENCES "EventDate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignUp" ADD CONSTRAINT "SignUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignUp" ADD CONSTRAINT "SignUp_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Song" ADD CONSTRAINT "Song_signUpId_fkey" FOREIGN KEY ("signUpId") REFERENCES "SignUp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Song" ADD CONSTRAINT "Song_eventDateId_fkey" FOREIGN KEY ("eventDateId") REFERENCES "EventDate"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Two rounds per singer: round is 1 or 2, and a sign-up holds at most one
-- active song per round.
ALTER TABLE "Song" ADD CONSTRAINT "Song_round_check" CHECK ("round" IN (1, 2));
CREATE UNIQUE INDEX "Song_active_round_per_signup" ON "Song"("signUpId", "round") WHERE "status" = 'ACTIVE';

-- First pick wins: a song title or YouTube video can be held by only one
-- active pick per event date, across both rounds. Enforced here so
-- simultaneous saves can't both win.
CREATE UNIQUE INDEX "Song_active_title_per_date" ON "Song"("eventDateId", "normalizedTitle") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "Song_active_video_per_date" ON "Song"("eventDateId", "youtubeVideoId") WHERE "status" = 'ACTIVE' AND "youtubeVideoId" IS NOT NULL;
