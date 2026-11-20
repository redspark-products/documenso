import { prisma } from '@documenso/prisma';
import { DocumentStatus, EnvelopeType, RecipientRole, SigningStatus } from '@prisma/client';

import { SELFIE_CONSENT_TEXT_VERSION } from '../../constants/recipient-selfie';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { assertRecipientNotExpired } from '../../utils/recipients';
import { isRecipientAuthorized } from '../document/is-recipient-authorized';
import { assertSenderNotDisabled } from '../user/assert-user-not-disabled';
import { storeRecipientSelfie } from './store-recipient-selfie';

export type UploadRecipientSelfieWithTokenOptions = {
  token: string;
  image: Uint8Array;
  consentTextVersion: string;
  userId?: number;
  requestMetadata?: RequestMetadata;
};

export const uploadRecipientSelfieWithToken = async ({
  token,
  image,
  consentTextVersion,
  userId,
  requestMetadata,
}: UploadRecipientSelfieWithTokenOptions) => {
  const recipient = await prisma.recipient.findFirst({
    where: {
      token,
      envelope: {
        type: EnvelopeType.DOCUMENT,
      },
    },
    include: {
      envelope: {
        select: {
          id: true,
          status: true,
          userId: true,
          authOptions: true,
          documentMeta: {
            select: {
              requireSignerSelfie: true,
            },
          },
        },
      },
    },
  });

  if (!recipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Recipient not found for the provided signing token',
    });
  }

  const { envelope } = recipient;

  await assertSenderNotDisabled({ userId: envelope.userId });

  if (envelope.status !== DocumentStatus.PENDING) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Document ${envelope.id} must be pending to capture a selfie`,
    });
  }

  if (recipient.signingStatus !== SigningStatus.NOT_SIGNED) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Recipient ${recipient.id} has already signed or rejected the document`,
    });
  }

  assertRecipientNotExpired(recipient);

  if (recipient.role !== RecipientRole.SIGNER || !envelope.documentMeta?.requireSignerSelfie) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: `Recipient ${recipient.id} is not required to provide a selfie`,
    });
  }

  // A stale signing page would otherwise record consent to a text the signer
  // was never shown.
  if (consentTextVersion !== SELFIE_CONSENT_TEXT_VERSION) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Selfie consent text version is outdated, reload the signing page',
    });
  }

  const isAccessAuthorized = await isRecipientAuthorized({
    type: 'ACCESS',
    documentAuthOptions: envelope.authOptions,
    recipient,
    userId,
  });

  if (!isAccessAuthorized) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Invalid access values',
    });
  }

  const selfie = await storeRecipientSelfie({
    recipientId: recipient.id,
    envelopeId: envelope.id,
    image,
    consentGivenAt: new Date(),
    consentTextVersion,
    requestMetadata,
  });

  await prisma.documentAuditLog.create({
    data: createDocumentAuditLogData({
      type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_SELFIE_CAPTURED,
      envelopeId: envelope.id,
      user: {
        name: recipient.name,
        email: recipient.email,
      },
      requestMetadata,
      data: {
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        recipientId: recipient.id,
        recipientRole: recipient.role,
        selfieId: selfie.id,
        sha256: selfie.sha256,
        consentTextVersion: selfie.consentTextVersion,
      },
    }),
  });

  return {
    id: selfie.id,
    sha256: selfie.sha256,
    capturedAt: selfie.capturedAt,
  };
};
