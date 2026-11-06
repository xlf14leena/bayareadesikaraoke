-- Payment is now an "I've paid" checkbox with an optional Zelle name; no
-- screenshots are kept. Keep the upload time as paidAt so payment order
-- doesn't change for sign-ups that already sent one, then delete them all.
ALTER TABLE "SignUp" ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "zelleName" TEXT;

UPDATE "SignUp" s SET "paidAt" = p."uploadedAt"
FROM "PaymentScreenshot" p WHERE p."signUpId" = s."id";

DROP TABLE "PaymentScreenshot";

ALTER TABLE "SignUp" DROP COLUMN "screenshotKey";
