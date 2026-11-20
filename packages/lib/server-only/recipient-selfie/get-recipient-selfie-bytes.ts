import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';
import type { RecipientSelfie } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { getFileServerSide } from '../../universal/upload/get-file.server';
import { decryptSelfieBytes } from './selfie-encryption';

export type GetRecipientSelfieBytesOptions = {
  selfie: Pick<RecipientSelfie, 'dataType' | 'data' | 'sha256'>;
};

/**
 * Throws if the decrypted image no longer matches the hash recorded at capture
 * time, so tampered evidence is never rendered into a certificate or served.
 */
export const getRecipientSelfieBytes = async ({ selfie }: GetRecipientSelfieBytesOptions) => {
  const ciphertext = await getFileServerSide({ type: selfie.dataType, data: selfie.data });

  const plaintext = decryptSelfieBytes(ciphertext);

  if (bytesToHex(sha256(plaintext)) !== selfie.sha256) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Recipient selfie integrity check failed',
    });
  }

  return plaintext;
};
