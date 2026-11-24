import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { SELFIE_CONSENT_TEXT_VERSION } from '@documenso/lib/constants/recipient-selfie';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { completeDocumentWithToken } from '@documenso/lib/server-only/document/complete-document-with-token';
import { getRecipientSelfieBytes } from '@documenso/lib/server-only/recipient-selfie/get-recipient-selfie-bytes';
import { uploadRecipientSelfieWithToken } from '@documenso/lib/server-only/recipient-selfie/upload-recipient-selfie-with-token';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { prisma } from '@documenso/prisma';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { DocumentStatus, FieldType, SigningStatus } from '@prisma/client';
import sharp from 'sharp';

import { apiSignin, apiSignout } from '../fixtures/authentication';
import { signSignaturePad } from '../fixtures/signature';

test.use({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
  permissions: ['camera'],
});

type SeededRecipient = Awaited<ReturnType<typeof seedPendingDocumentWithFullFields>>['recipients'][number];

const seedSelfieDocument = async ({ requireSignerSelfie = true } = {}) => {
  const { user: owner, team } = await seedUser();
  const { user: signerA } = await seedUser();
  const { user: signerB } = await seedUser();

  const { document, recipients } = await seedPendingDocumentWithFullFields({
    owner,
    teamId: team.id,
    recipients: [signerA, signerB],
    fields: [FieldType.SIGNATURE],
  });

  await prisma.documentMeta.update({
    where: { id: document.documentMetaId },
    data: { requireSignerSelfie },
  });

  return { owner, document, recipients };
};

const createJpeg = async (background: string) =>
  new Uint8Array(
    await sharp({ create: { width: 64, height: 48, channels: 3, background } })
      .jpeg()
      .toBuffer(),
  );

const signWithSelfie = async (page: Page, recipient: SeededRecipient) => {
  const signUrl = `/sign/${recipient.token}`;

  await page.goto(signUrl);
  await expect(page.getByRole('heading', { name: 'Sign Document' })).toBeVisible();

  await signSignaturePad(page);

  for (const field of recipient.fields) {
    await page.locator(`#field-${field.id}`).getByRole('button').click();
    await expect(page.locator(`#field-${field.id}`)).toHaveAttribute('data-inserted', 'true');
  }

  await page.getByRole('button', { name: 'Complete' }).click();
  await page.getByRole('button', { name: 'Sign' }).click();

  const selfieStep = page.getByTestId('signer-selfie-step');

  await expect(selfieStep).toBeVisible();

  // Opening the camera without consent must not be possible.
  await selfieStep.getByRole('button', { name: 'Open camera' }).click();
  await expect(page.getByTestId('signer-selfie-video')).toHaveCount(0);

  await page.getByTestId('signer-selfie-consent-checkbox').click();
  await selfieStep.getByRole('button', { name: 'Open camera' }).click();

  await expect(page.getByTestId('signer-selfie-video')).toBeVisible();
  await expect
    .poll(() => page.getByTestId('signer-selfie-video').evaluate((video: HTMLVideoElement) => video.videoWidth))
    .toBeGreaterThan(0);

  await selfieStep.getByRole('button', { name: 'Take photo' }).click();
  await expect(page.getByTestId('signer-selfie-preview')).toBeVisible();

  await selfieStep.getByRole('button', { name: 'Use this photo' }).click();

  await page.waitForURL(`${signUrl}/complete`);
};

const expectAppErrorCode = async (promise: Promise<unknown>, code: AppErrorCode | string) => {
  const error = await promise.then(
    () => null,
    (err: unknown) => AppError.parseError(err),
  );

  expect(error?.code).toBe(code);
};

test('[SIGNER_SELFIE]: each signer binds their own selfie and the evidence is restricted to the document team', async ({
  page,
}) => {
  const { owner, document, recipients } = await seedSelfieDocument();
  const [recipientA, recipientB] = recipients;

  await signWithSelfie(page, recipientA);
  await signWithSelfie(page, recipientB);

  const selfies = await prisma.recipientSelfie.findMany({
    where: { envelopeId: document.id },
    orderBy: { recipientId: 'asc' },
  });

  expect(selfies.map((selfie) => selfie.recipientId)).toEqual([recipientA.id, recipientB.id].sort((a, b) => a - b));
  expect(selfies.every((selfie) => selfie.consentTextVersion === SELFIE_CONSENT_TEXT_VERSION)).toBe(true);

  for (const selfie of selfies) {
    const plaintext = await getRecipientSelfieBytes({ selfie });

    expect(bytesToHex(sha256(plaintext))).toBe(selfie.sha256);
    // Stored bytes are ciphertext, never the image itself.
    expect(selfie.data).not.toContain(Buffer.from(plaintext).toString('base64').slice(0, 64));
  }

  const auditLogs = await prisma.documentAuditLog.findMany({
    where: { envelopeId: document.id, type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_SELFIE_CAPTURED },
  });

  expect(auditLogs.map((log) => (log.data as { sha256: string }).sha256).sort()).toEqual(
    selfies.map((selfie) => selfie.sha256).sort(),
  );

  await expect
    .poll(async () => {
      const envelope = await prisma.envelope.findUniqueOrThrow({ where: { id: document.id } });

      return envelope.status;
    })
    .toBe(DocumentStatus.COMPLETED);

  const selfieUrl = `${NEXT_PUBLIC_WEBAPP_URL()}/api/files/envelope/${document.id}/recipient/${recipientA.id}/selfie`;

  const anonymousResponse = await page.request.get(selfieUrl);
  expect(anonymousResponse.status()).toBe(404);

  const { user: outsider } = await seedUser();

  await apiSignin({ page, email: outsider.email });
  const outsiderResponse = await page.request.get(selfieUrl);
  expect(outsiderResponse.status()).toBe(404);
  await apiSignout({ page });

  await apiSignin({ page, email: owner.email });
  const ownerResponse = await page.request.get(selfieUrl);
  expect(ownerResponse.status()).toBe(200);
  expect(ownerResponse.headers()['cache-control']).toBe('private, no-store');
  expect(bytesToHex(sha256(await ownerResponse.body()))).toBe(
    selfies.find((selfie) => selfie.recipientId === recipientA.id)?.sha256,
  );
});

test('[SIGNER_SELFIE]: completion is refused until the signer has a selfie', async () => {
  const { document, recipients } = await seedSelfieDocument();
  const [recipient] = recipients;

  await prisma.field.updateMany({
    where: { recipientId: recipient.id },
    data: { inserted: true, customText: 'signed' },
  });

  await expectAppErrorCode(
    completeDocumentWithToken({ token: recipient.token, id: { type: 'envelopeId', id: document.id } }),
    AppErrorCode.RECIPIENT_SELFIE_REQUIRED,
  );

  const unchanged = await prisma.recipient.findUniqueOrThrow({ where: { id: recipient.id } });
  expect(unchanged.signingStatus).toBe(SigningStatus.NOT_SIGNED);

  await uploadRecipientSelfieWithToken({
    token: recipient.token,
    image: await createJpeg('#336699'),
    consentTextVersion: SELFIE_CONSENT_TEXT_VERSION,
  });

  await completeDocumentWithToken({ token: recipient.token, id: { type: 'envelopeId', id: document.id } });

  const signed = await prisma.recipient.findUniqueOrThrow({ where: { id: recipient.id } });
  expect(signed.signingStatus).toBe(SigningStatus.SIGNED);
});

test('[SIGNER_SELFIE]: selfie upload rejects bad tokens, stale consent, non-images, disabled flag and signed recipients', async () => {
  const { document, recipients } = await seedSelfieDocument();
  const [recipientA, recipientB] = recipients;
  const image = await createJpeg('#996633');

  await expectAppErrorCode(
    uploadRecipientSelfieWithToken({ token: 'not-a-token', image, consentTextVersion: SELFIE_CONSENT_TEXT_VERSION }),
    AppErrorCode.NOT_FOUND,
  );

  await expectAppErrorCode(
    uploadRecipientSelfieWithToken({ token: recipientA.token, image, consentTextVersion: 'outdated' }),
    AppErrorCode.INVALID_REQUEST,
  );

  await expectAppErrorCode(
    uploadRecipientSelfieWithToken({
      token: recipientA.token,
      image: new TextEncoder().encode('%PDF-1.7 not an image'),
      consentTextVersion: SELFIE_CONSENT_TEXT_VERSION,
    }),
    'INVALID_IMAGE_FILE',
  );

  const uploaded = await uploadRecipientSelfieWithToken({
    token: recipientA.token,
    image,
    consentTextVersion: SELFIE_CONSENT_TEXT_VERSION,
  });

  const stored = await prisma.recipientSelfie.findUniqueOrThrow({ where: { id: uploaded.id } });
  expect(stored.recipientId).toBe(recipientA.id);
  expect(await prisma.recipientSelfie.count({ where: { recipientId: recipientB.id } })).toBe(0);

  await prisma.field.updateMany({
    where: { recipientId: recipientA.id },
    data: { inserted: true, customText: 'signed' },
  });

  await completeDocumentWithToken({ token: recipientA.token, id: { type: 'envelopeId', id: document.id } });

  await expectAppErrorCode(
    uploadRecipientSelfieWithToken({ token: recipientA.token, image, consentTextVersion: SELFIE_CONSENT_TEXT_VERSION }),
    AppErrorCode.INVALID_REQUEST,
  );

  const { recipients: flagOffRecipients } = await seedSelfieDocument({ requireSignerSelfie: false });

  await expectAppErrorCode(
    uploadRecipientSelfieWithToken({
      token: flagOffRecipients[0].token,
      image,
      consentTextVersion: SELFIE_CONSENT_TEXT_VERSION,
    }),
    AppErrorCode.INVALID_REQUEST,
  );
});
