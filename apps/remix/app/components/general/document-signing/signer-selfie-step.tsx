import { SELFIE_CONSENT_TEXT_VERSION } from '@documenso/lib/constants/recipient-selfie';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import { DialogFooter } from '@documenso/ui/primitives/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { CameraIcon, RefreshCwIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import { z } from 'zod';

export type SignerSelfieStepProps = {
  token: string;
  onCaptured: () => void;
  onCancel: () => void;
};

type CameraError = 'insecure-context' | 'permission-denied' | 'no-camera' | 'camera-busy' | 'unknown';

type Step = 'consent' | 'camera' | 'preview';

export const SignerSelfieStep = ({ token, onCaptured, onCancel }: SignerSelfieStepProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [step, setStep] = useState<Step>('consent');
  const [cameraError, setCameraError] = useState<CameraError | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [hasUploadError, setHasUploadError] = useState(false);

  const { mutateAsync: uploadSelfie, isPending: isUploading } = trpc.recipient.uploadRecipientSelfie.useMutation();

  const consentForm = useForm<TSelfieConsentFormSchema>({
    resolver: zodResolver(ZSelfieConsentFormSchema),
    defaultValues: { consent: false },
  });

  const stopCamera = () => {
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }

    streamRef.current = null;
  };

  const startCamera = async () => {
    setCameraError(null);

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('insecure-context');
      return;
    }

    setIsStartingCamera(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });

      streamRef.current = stream;
      setStep('camera');
    } catch (error) {
      setCameraError(toCameraError(error));
    } finally {
      setIsStartingCamera(false);
    }
  };

  useEffect(() => {
    if (step === 'camera' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [step]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (capturedImage) {
        URL.revokeObjectURL(capturedImage.url);
      }
    };
  }, [capturedImage]);

  const capture = () => {
    const video = videoRef.current;

    if (!video || video.videoWidth === 0) {
      return;
    }

    const canvas = document.createElement('canvas');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError('unknown');
          return;
        }

        stopCamera();
        setCapturedImage({ blob, url: URL.createObjectURL(blob) });
        setStep('preview');
      },
      'image/jpeg',
      0.85,
    );
  };

  const retake = async () => {
    setCapturedImage(null);
    setHasUploadError(false);

    await startCamera();
  };

  const confirm = async () => {
    if (!capturedImage) {
      return;
    }

    setHasUploadError(false);

    const formData = new FormData();

    formData.append(
      'payload',
      JSON.stringify({ token, consent: true, consentTextVersion: SELFIE_CONSENT_TEXT_VERSION }),
    );
    formData.append('file', new File([capturedImage.blob], 'selfie.jpg', { type: 'image/jpeg' }));

    try {
      await uploadSelfie(formData);

      onCaptured();
    } catch {
      setHasUploadError(true);
    }
  };

  const handleCancel = () => {
    stopCamera();
    onCancel();
  };

  return (
    <div className="flex flex-col gap-4" data-testid="signer-selfie-step">
      {match(step)
        .with('consent', () => (
          <Form {...consentForm}>
            <form onSubmit={consentForm.handleSubmit(startCamera)}>
              <fieldset disabled={isStartingCamera} className="flex flex-col gap-4 border-none p-0">
                <div className="space-y-2 text-muted-foreground text-sm">
                  <p>
                    <Trans>
                      To confirm your identity, the sender of this document requires a photo of your face (selfie) taken
                      now with your camera.
                    </Trans>
                  </p>
                  <p>
                    <Trans>
                      The selfie is biometric personal data. It is stored encrypted together with the signing records of
                      this document and included in the signing certificate, which is shared with every party to this
                      document.
                    </Trans>
                  </p>
                  <p>
                    <Trans>
                      If you do not agree, cancel and use the reject option on the document instead. To exercise your
                      rights over this data, contact the sender of this document.
                    </Trans>
                  </p>
                </div>

                <FormField
                  control={consentForm.control}
                  name="consent"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex flex-row items-start gap-3">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => field.onChange(checked === true)}
                            data-testid="signer-selfie-consent-checkbox"
                          />
                        </FormControl>

                        <FormLabel className="font-normal leading-snug">
                          <Trans>
                            I explicitly consent to the capture, storage and use of my selfie as proof of identity for
                            signing this document.
                          </Trans>
                        </FormLabel>
                      </div>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                {cameraError && <SignerSelfieCameraErrorAlert error={cameraError} />}

                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={handleCancel}>
                    <Trans>Cancel</Trans>
                  </Button>

                  <Button type="submit" loading={isStartingCamera}>
                    <CameraIcon className="mr-2 h-4 w-4" />
                    <Trans>Open camera</Trans>
                  </Button>
                </DialogFooter>
              </fieldset>
            </form>
          </Form>
        ))
        .with('camera', () => (
          <>
            <div className="overflow-hidden rounded-lg border border-border bg-black">
              {/* playsInline and muted are required for inline playback on iOS Safari. */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="aspect-[4/3] w-full -scale-x-100 object-cover"
                data-testid="signer-selfie-video"
              />
            </div>

            {cameraError && <SignerSelfieCameraErrorAlert error={cameraError} />}

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={handleCancel}>
                <Trans>Cancel</Trans>
              </Button>

              <Button type="button" onClick={capture}>
                <CameraIcon className="mr-2 h-4 w-4" />
                <Trans>Take photo</Trans>
              </Button>
            </DialogFooter>
          </>
        ))
        .with('preview', () => (
          <>
            <div className="overflow-hidden rounded-lg border border-border bg-black">
              <img
                src={capturedImage?.url}
                alt=""
                className="aspect-[4/3] w-full object-cover"
                data-testid="signer-selfie-preview"
              />
            </div>

            {hasUploadError && (
              <Alert variant="destructive">
                <AlertDescription>
                  <Trans>We could not save your selfie. Please try again.</Trans>
                </AlertDescription>
              </Alert>
            )}

            <fieldset disabled={isUploading} className="border-none p-0">
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={retake}>
                  <RefreshCwIcon className="mr-2 h-4 w-4" />
                  <Trans>Retake</Trans>
                </Button>

                <Button type="button" onClick={confirm} loading={isUploading}>
                  <Trans>Use this photo</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </>
        ))
        .exhaustive()}
    </div>
  );
};

const SignerSelfieCameraErrorAlert = ({ error }: { error: CameraError }) => (
  <Alert variant="destructive" data-testid="signer-selfie-camera-error">
    <AlertDescription>
      {match(error)
        .with('insecure-context', () => (
          <Trans>
            The camera is only available on a secure (HTTPS) connection. Open the signing link over HTTPS and try again.
          </Trans>
        ))
        .with('permission-denied', () => (
          <Trans>
            Camera access was blocked. Allow camera access for this site in your browser settings, then try again.
          </Trans>
        ))
        .with('no-camera', () => (
          <Trans>No camera was found on this device. Open the signing link on a device with a camera.</Trans>
        ))
        .with('camera-busy', () => (
          <Trans>The camera is being used by another application. Close it and try again.</Trans>
        ))
        .with('unknown', () => <Trans>The camera could not be started. Please try again.</Trans>)
        .exhaustive()}
    </AlertDescription>
  </Alert>
);

const toCameraError = (error: unknown): CameraError => {
  const name = error instanceof DOMException ? error.name : '';

  return match(name)
    .with('NotAllowedError', 'SecurityError', () => 'permission-denied' as const)
    .with('NotFoundError', 'OverconstrainedError', () => 'no-camera' as const)
    .with('NotReadableError', 'AbortError', () => 'camera-busy' as const)
    .otherwise(() => 'unknown' as const);
};

const ZSelfieConsentFormSchema = z.object({
  consent: z.literal(true, {
    errorMap: () => ({ message: msg`You must consent before taking the selfie`.id }),
  }),
});

type TSelfieConsentFormSchema = { consent: boolean };
