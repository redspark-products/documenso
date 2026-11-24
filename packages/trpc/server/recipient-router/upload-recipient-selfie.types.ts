import { SELFIE_ACCEPTED_MIME_TYPES, SELFIE_UPLOAD_MAX_SIZE_BYTES } from '@documenso/lib/constants/recipient-selfie';
import { z } from 'zod';
import { zfd } from 'zod-form-data';

import { zodFormData } from '../../utils/zod-form-data';

export const ZUploadRecipientSelfiePayloadSchema = z.object({
  token: z.string().min(1),
  consent: z.literal(true),
  consentTextVersion: z.string().min(1),
});

/**
 * The declared MIME type is client controlled so this is only an early
 * rejection; the bytes are verified while the image is normalized.
 */
const zfdSelfieImageFile = () =>
  zfd
    .file()
    .refine((file) => file.size <= SELFIE_UPLOAD_MAX_SIZE_BYTES, {
      message: 'Selfie image is too large',
    })
    .refine((file) => SELFIE_ACCEPTED_MIME_TYPES.some((accepted) => accepted === file.type), {
      message: 'Selfie must be a JPEG or PNG image',
    });

export const ZUploadRecipientSelfieRequestSchema = zodFormData({
  payload: zfd.json(ZUploadRecipientSelfiePayloadSchema),
  file: zfdSelfieImageFile(),
});

export const ZUploadRecipientSelfieResponseSchema = z.object({
  id: z.string(),
  sha256: z.string(),
  capturedAt: z.date(),
});

export type TUploadRecipientSelfiePayload = z.infer<typeof ZUploadRecipientSelfiePayloadSchema>;
export type TUploadRecipientSelfieResponse = z.infer<typeof ZUploadRecipientSelfieResponseSchema>;
