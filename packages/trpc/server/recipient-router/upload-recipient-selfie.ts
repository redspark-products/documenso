import { assertRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limit-middleware';
import { recipientSelfieUploadRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limits';
import { uploadRecipientSelfieWithToken } from '@documenso/lib/server-only/recipient-selfie/upload-recipient-selfie-with-token';

import { procedure } from '../trpc';
import {
  ZUploadRecipientSelfieRequestSchema,
  ZUploadRecipientSelfieResponseSchema,
} from './upload-recipient-selfie.types';

// Note: This is intended to always be an internal route, authorized by the recipient token.
export const uploadRecipientSelfieRoute = procedure
  .input(ZUploadRecipientSelfieRequestSchema)
  .output(ZUploadRecipientSelfieResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { payload, file } = input;
    const { token, consentTextVersion } = payload;

    const rateLimitResult = await recipientSelfieUploadRateLimit.check({
      ip: ctx.metadata.requestMetadata.ipAddress ?? 'unknown',
    });

    assertRateLimit(rateLimitResult);

    return await uploadRecipientSelfieWithToken({
      token,
      image: new Uint8Array(await file.arrayBuffer()),
      consentTextVersion,
      userId: ctx.user?.id,
      requestMetadata: ctx.metadata.requestMetadata,
    });
  });
