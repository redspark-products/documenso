/**
 * Bump whenever the consent copy shown to signers changes, so every stored
 * selfie can be traced back to the exact text the signer agreed to.
 */
export const SELFIE_CONSENT_TEXT_VERSION = '2026-11-20.1';

export const SELFIE_UPLOAD_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export const SELFIE_ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png'] as const;

export const SELFIE_MAX_EDGE = 1024;
