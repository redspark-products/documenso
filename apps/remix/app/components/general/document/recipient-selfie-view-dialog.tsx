import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';
import { Trans, useLingui } from '@lingui/react/macro';
import { ScanFaceIcon } from 'lucide-react';
import { useState } from 'react';

export type RecipientSelfieViewDialogProps = {
  envelopeId: string;
  recipientId: number;
  recipientName: string;
};

export const RecipientSelfieViewDialog = ({
  envelopeId,
  recipientId,
  recipientName,
}: RecipientSelfieViewDialogProps) => {
  const { t } = useLingui();

  const [hasLoadError, setHasLoadError] = useState(false);

  return (
    <Dialog onOpenChange={() => setHasLoadError(false)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="ml-1 h-7 w-7 p-0"
              aria-label={t`View identity selfie`}
              data-testid={`recipient-selfie-view-${recipientId}`}
            >
              <ScanFaceIcon className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>

        <TooltipContent>
          <Trans>View identity selfie</Trans>
        </TooltipContent>
      </Tooltip>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Identity selfie</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>Captured by {recipientName} before signing. This is biometric data, do not share it.</Trans>
          </DialogDescription>
        </DialogHeader>

        {hasLoadError ? (
          <p className="text-muted-foreground text-sm">
            <Trans>No selfie is available for this recipient.</Trans>
          </p>
        ) : (
          <img
            src={`/api/files/envelope/${envelopeId}/recipient/${recipientId}/selfie`}
            alt={t`Identity selfie of ${recipientName}`}
            className="w-full rounded-lg border border-border"
            onError={() => setHasLoadError(true)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
