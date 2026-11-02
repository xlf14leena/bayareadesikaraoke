-- Zelle payment screenshots, stored privately in the database.
CREATE TABLE "PaymentScreenshot" (
    "signUpId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentScreenshot_pkey" PRIMARY KEY ("signUpId")
);

ALTER TABLE "PaymentScreenshot" ADD CONSTRAINT "PaymentScreenshot_signUpId_fkey" FOREIGN KEY ("signUpId") REFERENCES "SignUp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
