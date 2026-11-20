import { prisma } from '@documenso/prisma';
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';
import { DocumentDataType } from '@prisma/client';

import { SELFIE_MAX_EDGE } from '../../constants/recipient-selfie';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { getStorageProvider } from '../../universal/upload/providers';
import { putFileServerSide } from '../../universal/upload/put-file.server';
import { normalizeImage } from '../data-content/normalize-image';
import { encryptSelfieBytes } from './selfie-encryption';

export type StoreRecipientSelfieOptions = {
  recipientId: number;
  envelopeId: string;
  image: Uint8Array;
  consentGivenAt: Date;
  consentTextVersion: string;
  requestMetadata?: RequestMetadata;
};

export const storeRecipientSelfie = async ({
  recipientId,
  envelopeId,
  image,
  consentGivenAt,
  consentTextVersion,
  requestMetadata,
}: StoreRecipientSelfieOptions) => {
  const normalized = await normalizeImage(image, { maxEdge: SELFIE_MAX_EDGE });

  const hash = bytesToHex(sha256(normalized.buffer));

  const ciphertext = encryptSelfieBytes(normalized.buffer);

  const stored = await putFileServerSide({
    name: `recipient-selfie-${recipientId}.bin`,
    type: 'application/octet-stream',
    arrayBuffer: async () => ciphertext,
  });

  const previous = await prisma.recipientSelfie.findUnique({
    where: { recipientId },
    select: { dataType: true, data: true },
  });

  const selfieData = {
    envelopeId,
    dataType: stored.type,
    data: stored.data,
    mimeType: normalized.mimeType,
    sha256: hash,
    width: normalized.width,
    height: normalized.height,
    capturedAt: new Date(),
    ipAddress: requestMetadata?.ipAddress ?? null,
    userAgent: requestMetadata?.userAgent ?? null,
    consentGivenAt,
    consentTextVersion,
  };

  const selfie = await prisma.recipientSelfie.upsert({
    where: { recipientId },
    create: { recipientId, ...selfieData },
    update: selfieData,
  });

  if (previous?.dataType === DocumentDataType.S3_PATH && previous.data !== stored.data) {
    await getStorageProvider()
      .deleteFile(previous.data)
      .catch((error) => {
        console.error(`Failed to delete replaced recipient selfie object: ${String(error)}`);
      });
  }

  return selfie;
};
