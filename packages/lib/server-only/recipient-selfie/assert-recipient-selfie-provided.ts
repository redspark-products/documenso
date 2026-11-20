import { prisma } from '@documenso/prisma';
import { RecipientRole } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';

export type AssertRecipientSelfieProvidedOptions = {
  recipient: {
    id: number;
    role: RecipientRole;
  };
  requireSignerSelfie: boolean | undefined;
};

export const assertRecipientSelfieProvided = async ({
  recipient,
  requireSignerSelfie,
}: AssertRecipientSelfieProvidedOptions) => {
  if (!requireSignerSelfie || recipient.role !== RecipientRole.SIGNER) {
    return;
  }

  const selfie = await prisma.recipientSelfie.findUnique({
    where: {
      recipientId: recipient.id,
    },
    select: {
      id: true,
    },
  });

  if (!selfie) {
    throw new AppError(AppErrorCode.RECIPIENT_SELFIE_REQUIRED, {
      message: `Recipient ${recipient.id} must capture a selfie before completing the document`,
    });
  }
};
