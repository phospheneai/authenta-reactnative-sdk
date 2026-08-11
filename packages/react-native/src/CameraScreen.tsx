/**
 * STEP: camera — live preview with photo capture and/or video recording.
 *
 * Isolated sub-component that owns photoOutput + videoOutput hooks.
 * Keyed by cameraSessionKey in the parent so these hooks — and their underlying
 * native AVCaptureOutput objects — are fully destroyed and recreated for every
 * new camera session. On iOS, AVFoundation forbids an output from being attached
 * to more than one AVCaptureSession; sharing outputs across sessions (which happens
 * when the hooks live at the parent level) causes an unhandled NSException crash
 * on the second use. Android's Camera2 API has no such restriction.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  usePhotoOutput,
  useVideoOutput,
} from 'react-native-vision-camera';
import type { CameraOutput, Recorder } from 'react-native-vision-camera';

import { AuthentaError } from '@authenta/core';

import { HIT_SLOP, MAX_RETRIES, VIDEO_MAX_DURATION_MS, s } from './theme';
import type { CameraPosition, CaptureMode } from './types';
import { asFileUri, compressVideoIfNeeded } from './media';

export interface CameraScreenProps {
  captureMode: CaptureMode;
  cameraPosition: CameraPosition;
  retryCount: number;
  onCaptured: (uri: string) => void;
  onError: (err: Error | AuthentaError) => void;
  onBack: () => void;
  onSwitchCamera: () => void;
}

export function CameraScreen({
  captureMode,
  cameraPosition,
  retryCount,
  onCaptured,
  onError,
  onBack,
  onSwitchCamera,
}: CameraScreenProps) {
  const device = useCameraDevice(cameraPosition);

  // These hooks create native AVCaptureOutput objects. By living inside this
  // keyed component they are recreated fresh for every new session.
  const photoOutput = usePhotoOutput({ containerFormat: 'jpeg' });
  const videoOutput = useVideoOutput({
    enableAudio: captureMode !== 'photo',
    fileType: 'mp4',
    targetBitRate: 1_500_000,
  });

  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isRecording, setIsRecording]     = useState(false);

  const recorderRef         = useRef<Recorder | undefined>(undefined);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isRecordingRef      = useRef(false);
  const isMountedRef        = useRef(true);

  const cameraOutputs = useMemo<CameraOutput[]>(() => {
    const outputs: CameraOutput[] = [];
    if (captureMode === 'photo' || captureMode === 'both') outputs.push(photoOutput);
    if (captureMode === 'video' || captureMode === 'both') outputs.push(videoOutput);
    return outputs;
  }, [captureMode, photoOutput, videoOutput]);

  // Cleanup on unmount — stops any in-progress recording and clears timers.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = undefined;
      }
      const recorder = recorderRef.current;
      if (recorder && isRecordingRef.current) {
        isRecordingRef.current = false;
        recorder.stopRecording().catch(() => {});
      }
      recorderRef.current = undefined;
    };
  }, []);

  const clearRecordingState = useCallback(() => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = undefined;
    }
    recorderRef.current = undefined;
    isRecordingRef.current = false;
    setIsRecording(false);
  }, []);

  const handleStopRecording = useCallback(async () => {
    if (!isRecordingRef.current) return;
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = undefined;
    }
    const recorder = recorderRef.current;
    isRecordingRef.current = false;
    setIsRecording(false);
    if (!recorder) return;
    try {
      await recorder.stopRecording();
    } catch (err) {
      recorderRef.current = undefined;
      onError(err instanceof Error ? err : new AuthentaError(String(err)));
    }
  }, [onError]);

  const handleTakePhoto = useCallback(async () => {
    if (!isCameraReady) {
      onError(new AuthentaError('Camera is still starting. Please try again in a moment.'));
      return;
    }
    try {
      const photo = await photoOutput.capturePhotoToFile(
        { flashMode: 'off', enableShutterSound: true },
        {},
      );
      onCaptured(asFileUri(photo.filePath));
    } catch (err) {
      onError(err instanceof Error ? err : new AuthentaError(String(err)));
    }
  }, [isCameraReady, photoOutput, onCaptured, onError]);

  const handleStartRecording = useCallback(async () => {
    if (isRecordingRef.current) return;
    if (!isCameraReady) {
      onError(new AuthentaError('Camera is still starting. Please try again in a moment.'));
      return;
    }
    try {
      const recorder = await videoOutput.createRecorder({
        maxDuration: VIDEO_MAX_DURATION_MS / 1000,
        maxFileSize: 7 * 1024 * 1024,
      });
      recorderRef.current = recorder;

      await recorder.startRecording(
        async (filePath) => {
          clearRecordingState();
          if (!isMountedRef.current) return; // component unmounted; discard result
          const videoUri = await compressVideoIfNeeded(asFileUri(filePath));
          if (isMountedRef.current) onCaptured(videoUri);
        },
        (err) => {
          clearRecordingState();
          if (isMountedRef.current) {
            onError(new AuthentaError(err.message ?? 'Recording failed'));
          }
        },
      );

      isRecordingRef.current = true;
      setIsRecording(true);
      recordingTimeoutRef.current = setTimeout(() => {
        void handleStopRecording();
      }, VIDEO_MAX_DURATION_MS + 250);
    } catch (err) {
      clearRecordingState();
      onError(err instanceof Error ? err : new AuthentaError(String(err)));
    }
  }, [isCameraReady, videoOutput, onCaptured, onError, handleStopRecording, clearRecordingState]);

  // Stop recording then navigate back.
  const handleBack = useCallback(async () => {
    await handleStopRecording();
    onBack();
  }, [handleStopRecording, onBack]);

  if (!device) {
    return (
      <View style={s.centeredContent}>
        <Text style={s.errorText}>
          No {cameraPosition} camera available on this device.
        </Text>
        <TouchableOpacity style={s.secondaryBtn} onPress={onSwitchCamera}>
          <Text style={s.secondaryBtnText}>Switch Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.cameraScreen}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        outputs={cameraOutputs}
        onStarted={() => setIsCameraReady(true)}
        onStopped={() => setIsCameraReady(false)}
        onError={(err) => {
          const msg = err instanceof Error ? err.message : String(err);
          const isCameraStolen =
            msg.includes('Another app') || msg.includes('multiple foreground');
          const isAudioConflict = msg.includes('!pri');
          const friendly = isCameraStolen
            ? 'The camera is in use by another app (e.g. FaceTime or Zoom). Please end that call and try again.'
            : isAudioConflict
              ? 'The camera was interrupted by a phone call. End the call and tap Try Again.'
              : msg;
          onError(new AuthentaError(friendly));
        }}
      />

      {/* Top overlay */}
      <SafeAreaView style={s.cameraTopOverlay}>
        <TouchableOpacity
          onPress={() => void handleBack()}
          style={[s.cameraBackBtn, isRecording && s.cameraFlipBtnDisabled]}
          hitSlop={HIT_SLOP}
          disabled={isRecording}
        >
          <Text style={s.cameraBackBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={s.cameraModeBadge}>
          <Text style={s.cameraModeBadgeText}>
            {captureMode === 'video' ? '🎥 Video (max 10 s)'
              : captureMode === 'both' ? '📷 Photo  /  🎥 Video'
              : '📷 Photo'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onSwitchCamera}
          style={[s.cameraFlipBtn, isRecording && s.cameraFlipBtnDisabled]}
          hitSlop={HIT_SLOP}
          disabled={isRecording}
        >
          <Text style={s.cameraFlipBtnText}>⟳</Text>
          <Text style={s.cameraFlipBtnLabel}>
            {cameraPosition === 'front' ? 'Rear' : 'Selfie'}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Bottom overlay */}
      <View style={s.cameraBottomOverlay}>
        <Text style={s.cameraHint}>
          {isRecording
            ? 'Recording… tap ■ to stop'
            : !isCameraReady
              ? 'Camera is starting…'
            : captureMode === 'video'
              ? 'Position your face and tap ● to record'
              : captureMode === 'both'
                ? 'Take a photo  or  record a video'
                : 'Position your face and tap ● to capture'}
        </Text>

        <View style={s.cameraControls}>
          {(captureMode === 'photo' || captureMode === 'both') && !isRecording && (
            <View style={s.captureBtnWrapper}>
              <TouchableOpacity
                style={[s.captureBtn, !isCameraReady && s.captureBtnDisabled]}
                onPress={handleTakePhoto}
                disabled={!isCameraReady}
              >
                <View style={s.captureBtnDot} />
              </TouchableOpacity>
              {captureMode === 'both' && (
                <Text style={s.captureBtnLabel}>Photo</Text>
              )}
            </View>
          )}

          {(captureMode === 'video' || captureMode === 'both') && !isRecording && (
            <View style={s.captureBtnWrapper}>
              <TouchableOpacity
                style={[s.captureBtn, s.recordBtn, !isCameraReady && s.captureBtnDisabled]}
                onPress={handleStartRecording}
                disabled={!isCameraReady}
              >
                <View style={[s.captureBtnDot, s.recordBtnDot]} />
              </TouchableOpacity>
              {captureMode === 'both' && (
                <Text style={s.captureBtnLabel}>Video</Text>
              )}
            </View>
          )}

          {(captureMode === 'video' || captureMode === 'both') && isRecording && (
            <TouchableOpacity style={[s.captureBtn, s.stopBtn]} onPress={handleStopRecording}>
              <View style={s.stopBtnSquare} />
            </TouchableOpacity>
          )}
        </View>

        {retryCount > 0 && (
          <Text style={s.cameraAttempts}>
            Attempt {retryCount + 1} of {MAX_RETRIES}
          </Text>
        )}
      </View>
    </View>
  );
}
