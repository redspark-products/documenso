import { getOptionalNonEmbedSession } from '@documenso/auth/server/lib/session/embed-session-restrictions';
import { getEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { getRecipientSelfieBytes } from '@documenso/lib/server-only/recipient-selfie/get-recipient-selfie-bytes';
import { prisma } from '@documenso/prisma';
import { sValidator } from '@hono/standard-validator';
import { EnvelopeType } from '@prisma/client';
import { Hono } from 'hono';
import { z } from 'zod';

import type { HonoEnv } from '../../../router';

const route = new Hono<HonoEnv>();

const ZGetRecipientSelfieRequestParamsSchema = z.object({
  envelopeId: z.string().min(1),
  recipientId: z.coerce.number().int().positive(),
});

/**
 * Selfies are biometric data, so access follows the document page rules
 * (ownership, team membership and document visibility) rather than the looser
 * team-only check used for envelope files. Every failure is a 404 so the route
 * does not reveal whether a selfie exists.
 */
route.get(
  '/envelope/:envelopeId/recipient/:recipientId/selfie',
  sValidator('param', ZGetRecipientSelfieRequestParamsSchema),
  async (c) => {
    const { envelopeId, recipientId } = c.req.valid('param');

    const session = await getOptionalNonEmbedSession(c);

    const userId = session.user?.id;

    if (!userId) {
      return c.json({ error: 'Not found' }, 404);
    }

    const selfie = await prisma.recipientSelfie.findFirst({
      where: {
        envelopeId,
        recipientId,
      },
      include: {
        envelope: {
          select: {
            teamId: true,
          },
        },
      },
    });

    if (!selfie) {
      return c.json({ error: 'Not found' }, 404);
    }

    const envelopeWhereInput = await getEnvelopeWhereInput({
      id: { type: 'envelopeId', id: envelopeId },
      type: EnvelopeType.DOCUMENT,
      userId,
      teamId: selfie.envelope.teamId,
    })
      .then(({ envelopeWhereInput }) => envelopeWhereInput)
      .catch(() => null);

    const accessibleEnvelope = envelopeWhereInput
      ? await prisma.envelope.findFirst({ where: envelopeWhereInput, select: { id: true } })
      : null;

    if (!accessibleEnvelope) {
      return c.json({ error: 'Not found' }, 404);
    }

    const bytes = await getRecipientSelfieBytes({ selfie });

    return c.body(bytes, 200, {
      'Content-Type': selfie.mimeType,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
  },
);

export default route;
