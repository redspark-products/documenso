-- AlterTable
ALTER TABLE "DocumentMeta" ADD COLUMN "requireSignerSelfie" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN "requireSignerSelfie" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN "requireSignerSelfie" BOOLEAN;

-- CreateTable
CREATE TABLE "RecipientSelfie" (
    "id" TEXT NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "dataType" "DocumentDataType" NOT NULL,
    "data" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "consentGivenAt" TIMESTAMP(3) NOT NULL,
    "consentTextVersion" TEXT NOT NULL,

    CONSTRAINT "RecipientSelfie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecipientSelfie_recipientId_key" ON "RecipientSelfie"("recipientId");

-- CreateIndex
CREATE INDEX "RecipientSelfie_envelopeId_idx" ON "RecipientSelfie"("envelopeId");

-- AddForeignKey
ALTER TABLE "RecipientSelfie" ADD CONSTRAINT "RecipientSelfie_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipientSelfie" ADD CONSTRAINT "RecipientSelfie_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope"("id") ON DELETE CASCADE ON UPDATE CASCADE;
