/**
 * Detection flow — open the camera, run the model, show the verdict.
 *
 * The host app already chose the checks, so nothing is asked of the user:
 * the toggles decide whether the camera offers photo, video, or both.
 *
 * busy → camera → busy → result | error
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useCameraPermission } from 'react-native-vision-camera';

import { AuthentaError, ValidationError } from '@authenta/core';
import type { ProcessedMedia } from '@authenta/core';

import { CameraScreen } from '../CameraScreen';
import { resolveCaptureMode } from '../media';
import { s } from '../theme';
import type { AuthentaCaptureProps, CameraPosition, CaptureMode, DetectionStep } from '../types';
import { Button, ErrorView, KeyValue, Outcome, Page, Sheet, Spinner, useModalFlow } from '../ui';

export function DetectionFlow({
  client,
  visible,
  onClose,
  onResult,
  onError,
  modelType = 'FI-1',
  livenessCheck = false,
  faceswapCheck = false,
  faceSimilarityCheck = false,
  referenceImage,
}: AuthentaCaptureProps) {
  const [mode, setMode] = useState<CaptureMode>('photo');
  const [result, setResult] = useState<ProcessedMedia | undefined>();
  const [facing, setFacing] = useState<CameraPosition>('front');
  // Bumped on every camera entry to force fresh native outputs on iOS.
  const [session, setSession] = useState(0);

  const camera = useCameraPermission();
  const isFI = modelType.toUpperCase() === 'FI-1';

  const flow = useModalFlow<DetectionStep>({
    visible,
    initial: 'busy',
    onClose,
    onError,
    clear: () => { setMode('photo'); setFacing('front'); setResult(undefined); },
  });
  const { setStep, fail, close, run, isOpen, attempts } = flow;

  const toCamera = useCallback(() => {
    setSession(k => k + 1);
    setStep('camera');
  }, [setStep]);

  // Validate the toggles, take camera permission, pick the capture mode.
  useEffect(() => {
    if (!visible) return;
    void run('Preparing camera…', async () => {
      if (isFI && !livenessCheck && !faceswapCheck && !faceSimilarityCheck) {
        throw new ValidationError('Please enable at least one check.');
      }
      if (faceswapCheck && faceSimilarityCheck) {
        throw new ValidationError(
          'faceswapCheck and faceSimilarityCheck cannot be enabled together — ' +
          'faceswap requires video while similarity requires a photo.',
        );
      }
      if (!camera.hasPermission && !(await camera.requestPermission())) {
        throw new AuthentaError('Camera permission is required.');
      }
      // Detection analyses pixels only — video is recorded without audio, so no
      // microphone permission is ever requested.
      setMode(isFI ? resolveCaptureMode(livenessCheck, faceswapCheck, faceSimilarityCheck) : 'photo');
      toCamera();
    });
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const process = useCallback((uri: string) => {
    void run('Analysing… please wait', async () => {
      const media = await client.uploadAndPoll(uri, modelType, {
        livenessCheck,
        faceswapCheck,
        faceSimilarityCheck,
        referenceImage,
        contentType: mode === 'video' ? 'video/mp4' : 'image/jpeg',
      }) as ProcessedMedia;

      if (!isOpen.current) return;
      setResult(media);
      setStep('result');
      onResult?.(media);
    });
  }, [client, modelType, mode, livenessCheck, faceswapCheck, faceSimilarityCheck,
      referenceImage, onResult, run, setStep, isOpen]);

  return (
    <Sheet visible={visible} onRequestClose={close}>
      {flow.step === 'busy' && <Spinner message={flow.busy} />}

      {flow.step === 'camera' && (
        <CameraScreen
          key={session}
          captureMode={mode}
          cameraPosition={facing}
          retryCount={attempts.current}
          onCaptured={process}
          onError={fail}
          onBack={close}
          onSwitchCamera={() => setFacing(p => p === 'front' ? 'back' : 'front')}
        />
      )}

      {flow.step === 'result' && result && (
        <Page title="Detection Complete">
          <Outcome ok />
          <View style={[s.card, s.cardPad]}>
            <KeyValue label="id" value={result.id} />
            <KeyValue label="status" value={result.status} />
            <KeyValue label="taskTypeId" value={result.taskTypeId} />
            {result.result && <>
              <KeyValue label="isSpoof" value={result.result.isSpoof} />
              <KeyValue label="isDeepFake" value={result.result.isDeepFake} />
              <KeyValue label="isSimilar" value={result.result.isSimilar} />
              <KeyValue label="similarityScore" value={result.result.similarityScore} />
            </>}
          </View>
          <Button label="Done" onPress={close} />
        </Page>
      )}

      {flow.step === 'error' && (
        <ErrorView error={flow.error} attempts={attempts.current} onRetry={toCamera} onClose={close} />
      )}
    </Sheet>
  );
}
