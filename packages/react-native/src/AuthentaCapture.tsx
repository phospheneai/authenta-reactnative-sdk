/**
 * AuthentaCapture — modal that captures media and returns a detection result.
 *
 * The host app configures AuthentaClient and picks the checks, so this modal
 * asks the user nothing: on open it validates the request, takes the
 * permissions the resolved capture mode needs, opens the camera, then uploads
 * through AuthentaClient.uploadAndPoll() and hands back the ProcessedMedia.
 *
 * Flow: busy → [reference] → camera → busy → result | error
 *
 * Peer dependencies required in the host app:
 *   react-native-vision-camera >= 5
 *   react-native-image-picker  >= 7  (for the reference image picker)
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';

import { AuthentaError, ValidationError } from '@authenta/core';
import type { ProcessedMedia } from '@authenta/core';

import { CameraScreen } from './CameraScreen';
import { resolveCaptureMode } from './media';
import { s } from './theme';
import type { AuthentaCaptureProps, CameraPosition, CaptureMode, CaptureStep } from './types';
import { Button, ErrorView, KeyValue, Outcome, Page, Sheet, Spinner, useModalFlow } from './ui';

export type { AuthentaCaptureProps } from './types';

export function AuthentaCapture({
  client,
  modelType = 'FI-1',
  visible,
  onClose,
  onResult,
  onError,
  livenessCheck = false,
  faceswapCheck = false,
  faceSimilarityCheck = false,
}: AuthentaCaptureProps) {
  const [mode, setMode]                 = useState<CaptureMode>('photo');
  const [referenceUri, setReferenceUri] = useState<string | undefined>();
  const [result, setResult]             = useState<ProcessedMedia | undefined>();
  const [facing, setFacing]             = useState<CameraPosition>('front');
  // Bumped on every camera entry to force fresh native outputs on iOS.
  const [session, setSession]           = useState(0);

  const camera = useCameraPermission();
  const mic    = useMicrophonePermission();

  // Only FI-1 exposes the per-check options; other models run a plain photo capture.
  const isFI = modelType.toUpperCase() === 'FI-1';
  const needsReference = isFI && faceSimilarityCheck;

  const flow = useModalFlow<CaptureStep>({
    visible,
    initial: 'busy',
    onClose,
    onError,
    clear: () => {
      setMode('photo');
      setFacing('front');
      setReferenceUri(undefined);
      setResult(undefined);
    },
  });
  const { setStep, fail, close, run, isOpen, attempts } = flow;

  const toCamera = useCallback(() => {
    setSession(k => k + 1);
    setStep('camera');
  }, [setStep]);

  // ── Open: validate the requested checks, then take the permissions they need ─
  useEffect(() => {
    if (!visible) return;
    void run('Preparing camera…', async () => {
      if (isFI) {
        if (!livenessCheck && !faceswapCheck && !faceSimilarityCheck) {
          throw new ValidationError('Please enable at least one check.');
        }
        if (faceswapCheck && faceSimilarityCheck) {
          throw new ValidationError(
            'faceswapCheck and faceSimilarityCheck cannot be enabled together — ' +
            'faceswap requires video while similarity requires a photo.',
          );
        }
      }

      if (!camera.hasPermission && !(await camera.requestPermission())) {
        throw new AuthentaError('Camera permission is required.');
      }

      const resolved = isFI
        ? resolveCaptureMode(livenessCheck, faceswapCheck, faceSimilarityCheck)
        : 'photo';

      if (resolved !== 'photo' && !mic.hasPermission && !(await mic.requestPermission())) {
        throw new AuthentaError('Microphone permission is required for video recording.');
      }

      setMode(resolved);
      if (needsReference) setStep('reference');
      else toCamera();
    });
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickReference = useCallback(() => {
    launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 }, (res) => {
      if (res.didCancel) return;
      if (res.errorCode) {
        fail(new AuthentaError(`Image picker error: ${res.errorMessage ?? res.errorCode}`));
        return;
      }
      const uri = res.assets?.[0]?.uri;
      if (!uri) fail(new AuthentaError('No image was selected.'));
      else setReferenceUri(uri);
    });
  }, [fail]);

  // ── Capture → upload → poll ─────────────────────────────────────────────────
  const process = useCallback((uri: string) => {
    void run('Analysing… please wait', async () => {
      const media = await client.uploadAndPoll(uri, modelType, {
        livenessCheck,
        faceswapCheck,
        faceSimilarityCheck,
        referenceImage: faceSimilarityCheck ? referenceUri : undefined,
        contentType: mode === 'video' ? 'video/mp4' : 'image/jpeg',
      }) as ProcessedMedia;

      if (!isOpen.current) return;
      setResult(media);
      setStep('result');
      onResult(media);
    });
  }, [client, modelType, mode, livenessCheck, faceswapCheck, faceSimilarityCheck,
      referenceUri, onResult, run, setStep, isOpen]);

  return (
    <Sheet visible={visible} onRequestClose={close}>
      {flow.step === 'busy' && <Spinner message={flow.busy} />}

      {flow.step === 'reference' && (
        <Page
          scroll={false}
          title="Reference Image"
          subtitle="Select a clear photo of the face to compare against during detection."
          onClose={close}
        >
          {referenceUri ? (
            <View style={s.preview}>
              <Image source={{ uri: referenceUri }} style={s.thumb} resizeMode="cover" />
              <Button label="Change Photo" kind="secondary" onPress={pickReference} />
            </View>
          ) : (
            <Button label="Pick from Library" onPress={pickReference} />
          )}
          <Button label="Continue to Camera" onPress={toCamera} disabled={!referenceUri} />
        </Page>
      )}

      {flow.step === 'camera' && (
        <CameraScreen
          key={session}
          captureMode={mode}
          cameraPosition={facing}
          retryCount={attempts.current}
          onCaptured={process}
          onError={fail}
          // Nothing sits behind the camera unless a reference was picked.
          onBack={() => needsReference ? setStep('reference') : close()}
          onSwitchCamera={() => setFacing(p => p === 'front' ? 'back' : 'front')}
        />
      )}

      {flow.step === 'result' && result && (
        <Page title="Detection Complete">
          <Outcome ok />
          <View style={[s.card, s.cardPad]}>
            <KeyValue label="id"         value={result.id} />
            <KeyValue label="status"     value={result.status} />
            <KeyValue label="taskTypeId" value={result.taskTypeId} />
            {result.result && <>
              <KeyValue label="isSpoof"         value={result.result.isSpoof} />
              <KeyValue label="isDeepFake"      value={result.result.isDeepFake} />
              <KeyValue label="isSimilar"       value={result.result.isSimilar} />
              <KeyValue label="similarityScore" value={result.result.similarityScore} />
            </>}
          </View>
          <Button label="Done" onPress={close} />
        </Page>
      )}

      {flow.step === 'error' && (
        <ErrorView
          error={flow.error}
          attempts={attempts.current}
          onRetry={toCamera}
          onClose={close}
        />
      )}
    </Sheet>
  );
}
