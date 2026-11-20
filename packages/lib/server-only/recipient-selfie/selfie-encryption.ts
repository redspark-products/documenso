import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { managedNonce } from '@noble/ciphers/webcrypto';
import { sha256 } from '@noble/hashes/sha2';

import { DOCUMENSO_ENCRYPTION_SECONDARY_KEY } from '../../constants/crypto';

// Same primitive as `symmetricEncrypt`, but over raw bytes: going through the
// string-based helper would base64 the image first and inflate it by a third.
const getCipher = () => {
  if (!DOCUMENSO_ENCRYPTION_SECONDARY_KEY) {
    throw new Error('Missing NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY');
  }

  return managedNonce(xchacha20poly1305)(sha256(DOCUMENSO_ENCRYPTION_SECONDARY_KEY));
};

export const encryptSelfieBytes = (bytes: Uint8Array) => getCipher().encrypt(bytes);

export const decryptSelfieBytes = (bytes: Uint8Array) => getCipher().decrypt(bytes);
