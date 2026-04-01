/**
 * AuthentaCapture — self-contained modal UI for eKYC face capture.
 *
 * Uses react-native-vision-camera for live camera access, then passes the
 * captured URI straight to AuthentaClient.uploadAndPoll() and returns a ProcessedMedia
 * result via the onResult callback.
 *
 * Peer dependencies required in the host app:
 *   react-native-vision-camera >= 4
 *   react-native-image-picker  >= 7  (for the reference image picker)
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';
import type { PhotoFile, VideoFile } from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';

import { AuthentaClient, AuthentaError, ValidationError } from '@authenta/core';
import type { ModelType, ProcessedMedia } from '@authenta/core';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface AuthentaCaptureProps {
  /** Initialized AuthentaClient instance. */
  client: AuthentaClient;
  /** Model type to run against. Defaults to 'FI-1'. */
  modelType?: ModelType;
  /** Controls modal visibility. */
  visible: boolean;
  /** Called when the user dismisses the modal. */
  onClose: () => void;
  /** Called with the fully-processed result when detection completes. */
  onResult: (result: ProcessedMedia) => void;
  /** Called on API or capture errors. */
  onError?: (error: Error | AuthentaError) => void;
  /** Pre-enable the liveness check toggle. */
  livenessCheck?: boolean;
  /** Pre-enable the faceswap check toggle (video mode). */
  faceswapCheck?: boolean;
  /** Pre-enable the face similarity check toggle (photo mode + reference image). */
  faceSimilarityCheck?: boolean;
}

// ─── Internal types ───────────────────────────────────────────────────────────

type Step = 'toggles' | 'reference' | 'camera' | 'processing' | 'result' | 'error';
type CaptureMode = 'photo' | 'video' | 'both';

const MAX_RETRIES = 3;
const VIDEO_MAX_DURATION_MS = 10_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Capture mode rules:
 * 1. faceswap only              → video only
 * 2. liveness only              → photo OR video (user chooses on camera screen)
 * 3. similarity only            → photo only
 * 4. faceswap + liveness        → video only   (faceswap wins)
 * 5. liveness + similarity      → photo only   (similarity wins)
 */
function resolveCaptureMode(
  livenessCheck: boolean,
  faceswapCheck: boolean,
  faceSimilarityCheck: boolean,
): CaptureMode {
  if (faceswapCheck) return 'video';          // rules 1 & 4
  if (faceSimilarityCheck) return 'photo';    // rules 3 & 5
  if (livenessCheck) return 'both';           // rule 2
  return 'photo';                             // fallback (validation prevents this)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AuthentaCapture({
  client,
  modelType = 'FI-1',
  visible,
  onClose,
  onResult,
  onError,
  livenessCheck: initLiveness = false,
  faceswapCheck: initFaceswap = false,
  faceSimilarityCheck: initSimilarity = false,
}: AuthentaCaptureProps) {

  // ── Toggle state ────────────────────────────────────────────────────────────
  const [liveness, setLiveness]     = useState(initLiveness);
  const [faceswap, setFaceswap]     = useState(initFaceswap);
  const [similarity, setSimilarity] = useState(initSimilarity);

  // ── Flow state ──────────────────────────────────────────────────────────────
  const [step, setStep]                   = useState<Step>('toggles');
  const [captureMode, setCaptureMode]     = useState<CaptureMode>('photo');
  const [referenceUri, setReferenceUri]   = useState<string | undefined>();
  const [isRecording, setIsRecording]     = useState(false);
  const [lastResult, setLastResult]       = useState<ProcessedMedia | undefined>();
  const [lastError, setLastError]         = useState<Error | AuthentaError | undefined>();
  const retryCount                        = useRef(0);

  // ── Camera ──────────────────────────────────────────────────────────────────
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('front');
  const device = useCameraDevice(cameraPosition);
  const { hasPermission: hasCamPermission, requestPermission: requestCamPermission } = useCameraPermission();
  const { hasPermission: hasMicPermission, requestPermission: requestMicPermission } = useMicrophonePermission();
  const cameraRef     = useRef<Camera>(null);
  const isRecordingRef = useRef(false); // mirror of isRecording for async callbacks

  // ── Reset modal to initial state ────────────────────────────────────────────
  const reset = useCallback(() => {
    setLiveness(initLiveness);
    setFaceswap(initFaceswap);
    setSimilarity(initSimilarity);
    setStep('toggles');
    setCameraPosition('front');
    setReferenceUri(undefined);
    setIsRecording(false);
    isRecordingRef.current = false;
    setLastResult(undefined);
    setLastError(undefined);
    retryCount.current = 0;
  }, [initLiveness, initFaceswap, initSimilarity]);

  // Reset every time the modal opens
  React.useEffect(() => {
    if (visible) reset();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Error handler ────────────────────────────────────────────────────────────
  const handleError = useCallback((err: Error | AuthentaError) => {
    retryCount.current += 1;
    setLastError(err);
    setIsRecording(false);
    isRecordingRef.current = false;
    setStep('error');
    onError?.(err);
  }, [onError]);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP: toggles
  // ─────────────────────────────────────────────────────────────────────────────

  const handleContinue = useCallback(async () => {
    if (!liveness && !faceswap && !similarity) {
      handleError(new ValidationError('Please enable at least one check.'));
      return;
    }

    if (faceswap && similarity) {
      handleError(
        new ValidationError(
          'faceswapCheck and faceSimilarityCheck cannot be enabled together — ' +
          'faceswap requires video while similarity requires a photo.',
        ),
      );
      return;
    }

    if (!hasCamPermission) {
      const granted = await requestCamPermission();
      if (!granted) {
        handleError(new AuthentaError('Camera permission is required.'));
        return;
      }
    }

    const mode = resolveCaptureMode(liveness, faceswap, similarity);

    // Request microphone permission when video capture is possible
    if (mode === 'video' || mode === 'both') {
      if (!hasMicPermission) {
        const granted = await requestMicPermission();
        if (!granted) {
          handleError(new AuthentaError('Microphone permission is required for video recording.'));
          return;
        }
      }
    }

    setCaptureMode(mode);
    setStep(similarity ? 'reference' : 'camera');
  }, [liveness, faceswap, similarity, hasCamPermission, requestCamPermission, hasMicPermission, requestMicPermission, handleError]);

  const handleToggleFaceswap = useCallback((v: boolean) => {
    setFaceswap(v);
    if (v) setSimilarity(false); // faceswap and similarity conflict
  }, []);

  const handleToggleSimilarity = useCallback((v: boolean) => {
    setSimilarity(v);
    if (v) setFaceswap(false); // similarity and faceswap conflict
    if (!v) setReferenceUri(undefined);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP: reference image picker
  // ─────────────────────────────────────────────────────────────────────────────

  const handlePickReference = useCallback(() => {
    launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 }, (response) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        handleError(
          new AuthentaError(`Image picker error: ${response.errorMessage ?? response.errorCode}`),
        );
        return;
      }
      const uri = response.assets?.[0]?.uri;
      if (!uri) {
        handleError(new AuthentaError('No image was selected.'));
        return;
      }
      setReferenceUri(uri);
    });
  }, [handleError]);

  const handleReferenceNext = useCallback(() => {
    if (!referenceUri) return;
    setStep('camera');
  }, [referenceUri]);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP: camera — capture / record
  // ─────────────────────────────────────────────────────────────────────────────

  const runProcessing = useCallback(async (uri: string) => {
    setStep('processing');
    try {
      const result = await client.uploadAndPoll(uri, modelType, {
        livenessCheck: liveness,
        faceswapCheck: faceswap,
        faceSimilarityCheck: similarity,
        referenceImage: similarity ? referenceUri : undefined,
      });
      setLastResult(result);
      setStep('result');
      onResult(result);
    } catch (err) {
      handleError(err instanceof Error ? err : new AuthentaError(String(err)));
    }
  }, [client, modelType, liveness, faceswap, similarity, referenceUri, onResult, handleError]);

  const handleTakePhoto = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo: PhotoFile = await cameraRef.current.takePhoto();
      await runProcessing(`file://${photo.path}`);
    } catch (err) {
      handleError(err instanceof Error ? err : new AuthentaError(String(err)));
    }
  }, [runProcessing, handleError]);

  const handleStopRecording = useCallback(() => {
    if (isRecordingRef.current) {
      cameraRef.current?.stopRecording();
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  }, []);

  const handleStartRecording = useCallback(() => {
    if (!cameraRef.current || isRecordingRef.current) return;
    setIsRecording(true);
    isRecordingRef.current = true;

    cameraRef.current.startRecording({
      onRecordingFinished: async (video: VideoFile) => {
        isRecordingRef.current = false;
        setIsRecording(false);
        await runProcessing(`file://${video.path}`);
      },
      onRecordingError: (err) => {
        isRecordingRef.current = false;
        setIsRecording(false);
        handleError(new AuthentaError(err.message ?? 'Recording failed'));
      },
    });

    // Auto-stop after max duration
    setTimeout(() => {
      handleStopRecording();
    }, VIDEO_MAX_DURATION_MS);
  }, [runProcessing, handleError, handleStopRecording]);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP: retry / close
  // ─────────────────────────────────────────────────────────────────────────────

  const handleRetry = useCallback(() => {
    setLastError(undefined);
    setStep('camera');
  }, []);

  const handleClose = useCallback(() => {
    handleStopRecording();
    reset();
    onClose();
  }, [handleStopRecording, reset, onClose]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────────

  const isFI = modelType.toUpperCase() === 'FI-1';

  // ── Toggles screen ──────────────────────────────────────────────────────────
  function renderToggles() {
    return (
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.headerRow}>
          <Text style={s.title}>Detection Options</Text>
          <TouchableOpacity onPress={handleClose} style={s.closeBtn} hitSlop={HIT_SLOP}>
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.subtitle}>
          Enable the checks you need. At least one must be selected.
        </Text>

        {isFI ? (
          <>
            <ToggleRow
              icon="👁"
              label="Liveness Check"
              description="Verify the subject is a live person (photo)"
              value={liveness}
              onValueChange={setLiveness}
            />
            <ToggleRow
              icon="🔄"
              label="Faceswap Check"
              description="Detect AI face-swap manipulation (video, max 10 s)"
              value={faceswap}
              onValueChange={handleToggleFaceswap}
            />
            <ToggleRow
              icon="🪞"
              label="Face Similarity Check"
              description="Compare face to a reference photo (photo only)"
              value={similarity}
              onValueChange={handleToggleSimilarity}
            />
          </>
        ) : (
          <View style={s.infoCard}>
            <Text style={s.infoText}>
              Model <Text style={s.bold}>{modelType}</Text> will be applied automatically.
            </Text>
          </View>
        )}

        {retryCount.current > 0 && (
          <Text style={s.retryNote}>
            Attempt {retryCount.current + 1} of {MAX_RETRIES}
          </Text>
        )}

        <TouchableOpacity
          style={[s.primaryBtn, (!isFI || (!liveness && !faceswap && !similarity)) && s.btnDisabled]}
          onPress={isFI ? handleContinue : () => setStep('camera')}
          disabled={isFI && !liveness && !faceswap && !similarity}
        >
          <Text style={s.primaryBtnText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Reference image screen ──────────────────────────────────────────────────
  function renderReference() {
    return (
      <View style={s.content}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => setStep('toggles')} hitSlop={HIT_SLOP}>
            <Text style={s.backBtn}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.title}>Reference Image</Text>
          <TouchableOpacity onPress={handleClose} hitSlop={HIT_SLOP}>
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.subtitle}>
          Select a clear photo of the face to compare against during detection.
        </Text>

        {referenceUri ? (
          <View style={s.referencePreview}>
            <Image source={{ uri: referenceUri }} style={s.referenceThumb} resizeMode="cover" />
            <TouchableOpacity style={s.secondaryBtn} onPress={handlePickReference}>
              <Text style={s.secondaryBtnText}>Change Photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={s.primaryBtn} onPress={handlePickReference}>
            <Text style={s.primaryBtnText}>Pick from Library</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[s.primaryBtn, !referenceUri && s.btnDisabled]}
          onPress={handleReferenceNext}
          disabled={!referenceUri}
        >
          <Text style={s.primaryBtnText}>Continue to Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Camera screen ───────────────────────────────────────────────────────────
  function renderCamera() {
    if (!device) {
      return (
        <View style={s.centeredContent}>
          <Text style={s.errorText}>
            No {cameraPosition} camera available on this device.
          </Text>
          <TouchableOpacity
            style={s.secondaryBtn}
            onPress={() => setCameraPosition(p => p === 'front' ? 'back' : 'front')}
          >
            <Text style={s.secondaryBtnText}>Switch Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.primaryBtn} onPress={handleClose}>
            <Text style={s.primaryBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={s.cameraScreen}>
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={step === 'camera'}
          photo={captureMode === 'photo' || captureMode === 'both'}
          video={captureMode === 'video' || captureMode === 'both'}
          audio={captureMode === 'video' || captureMode === 'both'}
        />

        {/* Top overlay */}
        <SafeAreaView style={s.cameraTopOverlay}>
          <TouchableOpacity
            onPress={() => setStep(similarity ? 'reference' : 'toggles')}
            style={s.cameraBackBtn}
            hitSlop={HIT_SLOP}
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
            onPress={() => setCameraPosition(p => p === 'front' ? 'back' : 'front')}
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
              : captureMode === 'video'
                ? 'Position your face and tap ● to record'
                : captureMode === 'both'
                  ? 'Take a photo  or  record a video'
                  : 'Position your face and tap ● to capture'}
          </Text>

          <View style={s.cameraControls}>
            {/* Photo button — shown for photo-only or both */}
            {(captureMode === 'photo' || captureMode === 'both') && !isRecording && (
              <View style={s.captureBtnWrapper}>
                <TouchableOpacity style={s.captureBtn} onPress={handleTakePhoto}>
                  <View style={s.captureBtnDot} />
                </TouchableOpacity>
                {captureMode === 'both' && (
                  <Text style={s.captureBtnLabel}>Photo</Text>
                )}
              </View>
            )}

            {/* Record button — shown for video-only or both (when not recording) */}
            {(captureMode === 'video' || captureMode === 'both') && !isRecording && (
              <View style={s.captureBtnWrapper}>
                <TouchableOpacity style={[s.captureBtn, s.recordBtn]} onPress={handleStartRecording}>
                  <View style={[s.captureBtnDot, s.recordBtnDot]} />
                </TouchableOpacity>
                {captureMode === 'both' && (
                  <Text style={s.captureBtnLabel}>Video</Text>
                )}
              </View>
            )}

            {/* Stop button — shown while recording */}
            {(captureMode === 'video' || captureMode === 'both') && isRecording && (
              <TouchableOpacity style={[s.captureBtn, s.stopBtn]} onPress={handleStopRecording}>
                <View style={s.stopBtnSquare} />
              </TouchableOpacity>
            )}
          </View>

          {retryCount.current > 0 && (
            <Text style={s.cameraAttempts}>
              Attempt {retryCount.current + 1} of {MAX_RETRIES}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // ── Processing screen ────────────────────────────────────────────────────────
  function renderProcessing() {
    return (
      <View style={s.centeredContent}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={s.processingText}>Analysing… please wait</Text>
      </View>
    );
  }

  // ── Result screen ────────────────────────────────────────────────────────────
  function renderResult() {
    if (!lastResult) return null;
    const r = lastResult.result;
    return (
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.successIcon}>
          <Text style={s.successIconText}>✓</Text>
        </View>
        <Text style={s.title}>Detection Complete</Text>

        <View style={s.resultCard}>
          <ResultRow label="mid"            value={lastResult.mid} />
          <ResultRow label="status"         value={lastResult.status} />
          <ResultRow label="model"          value={lastResult.modelType} />
          {r && <>
            <ResultRow label="isLiveness"      value={r.isLiveness} />
            <ResultRow label="isDeepFake"      value={r.isDeepFake} />
            <ResultRow label="isSimilar"       value={r.isSimilar} />
            <ResultRow label="similarityScore" value={r.similarityScore} />
          </>}
        </View>

        <TouchableOpacity style={s.primaryBtn} onPress={handleClose}>
          <Text style={s.primaryBtnText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Error screen ─────────────────────────────────────────────────────────────
  function renderError() {
    const canRetry = retryCount.current < MAX_RETRIES;
    return (
      <View style={s.content}>
        <View style={s.errorIcon}>
          <Text style={s.errorIconText}>✕</Text>
        </View>
        <Text style={s.title}>Something Went Wrong</Text>
        <Text style={s.subtitle}>
          {retryCount.current >= MAX_RETRIES
            ? `Failed after ${MAX_RETRIES} attempts.`
            : `Attempt ${retryCount.current} of ${MAX_RETRIES}`}
        </Text>

        <View style={s.errorCard}>
          <Text style={s.errorText}>{lastError?.message ?? 'An unknown error occurred.'}</Text>
        </View>

        {canRetry && (
          <TouchableOpacity style={s.primaryBtn} onPress={handleRetry}>
            <Text style={s.primaryBtnText}>Try Again</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={s.secondaryBtn} onPress={handleClose}>
          <Text style={s.secondaryBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Modal root ────────────────────────────────────────────────────────────────
  const screens: Record<Step, () => React.ReactNode> = {
    toggles:    renderToggles,
    reference:  renderReference,
    camera:     renderCamera,
    processing: renderProcessing,
    result:     renderResult,
    error:      renderError,
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={s.safe}>
        {screens[step]()}
      </SafeAreaView>
    </Modal>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ToggleRow({
  icon, label, description, value, onValueChange,
}: {
  icon: string;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <TouchableOpacity style={s.toggleRow} onPress={() => onValueChange(!value)} activeOpacity={0.7}>
      <Text style={s.toggleIcon}>{icon}</Text>
      <View style={s.toggleText}>
        <Text style={s.toggleLabel}>{label}</Text>
        <Text style={s.toggleDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#d1d5db', true: ACCENT }}
        thumbColor="#fff"
      />
    </TouchableOpacity>
  );
}

function ResultRow({ label, value }: { label: string; value: any }) {
  if (value === undefined || value === null) return null;
  return (
    <View style={s.resultRow}>
      <Text style={s.resultRowLabel}>{label}</Text>
      <Text style={s.resultRowValue}>{String(value)}</Text>
    </View>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#6366f1';
const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 24, paddingBottom: 48 },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title:      { fontSize: 22, fontWeight: '700', color: '#111827', flex: 1 },
  subtitle:   { fontSize: 14, color: '#6b7280', lineHeight: 21, marginBottom: 24 },
  closeBtn:   { padding: 4 },
  closeBtnText: { fontSize: 18, color: '#9ca3af', fontWeight: '600' },
  backBtn:    { fontSize: 15, color: ACCENT, fontWeight: '600' },

  // Toggles
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  toggleIcon:  { fontSize: 22, marginRight: 12 },
  toggleText:  { flex: 1, marginRight: 8 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  toggleDesc:  { fontSize: 12, color: '#6b7280', marginTop: 2 },

  // Info card (non-FI models)
  infoCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  infoText: { fontSize: 14, color: '#1d4ed8', lineHeight: 20 },
  bold:     { fontWeight: '700' },

  // Retry note
  retryNote: {
    textAlign: 'center',
    fontSize: 13,
    color: '#f59e0b',
    marginBottom: 12,
    fontWeight: '600',
  },

  // Buttons
  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  btnDisabled:    { opacity: 0.4 },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  secondaryBtnText: { color: ACCENT, fontSize: 17, fontWeight: '600' },

  // Reference image
  referencePreview: { alignItems: 'center', marginBottom: 20 },
  referenceThumb: {
    width: 160,
    height: 160,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#e5e7eb',
  },

  // Camera
  cameraScreen:        { flex: 1, backgroundColor: '#000' },
  cameraTopOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  cameraBackBtn:     { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  cameraBackBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  cameraModeBadge:   { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  cameraModeBadgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  cameraFlipBtn:         { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, alignItems: 'center' },
  cameraFlipBtnDisabled: { opacity: 0.35 },
  cameraFlipBtnText:     { fontSize: 18, color: '#fff' },
  cameraFlipBtnLabel:    { fontSize: 10, color: '#fff', fontWeight: '600', marginTop: 1 },
  cameraBottomOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingBottom: 40,
    paddingTop: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  cameraHint:     { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginBottom: 20, textAlign: 'center', paddingHorizontal: 24 },
  cameraControls:    { flexDirection: 'row', gap: 32, marginBottom: 12 },
  captureBtnWrapper: { alignItems: 'center', gap: 6 },
  captureBtnLabel:   { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  cameraAttempts: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },

  // Capture / record buttons
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtnDot:  { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' },
  recordBtn:      { borderColor: '#ef4444' },
  recordBtnDot:   { backgroundColor: '#ef4444' },
  stopBtn:        { borderColor: '#ef4444' },
  stopBtnSquare:  { width: 28, height: 28, borderRadius: 4, backgroundColor: '#ef4444' },

  // Centered content (processing / no-camera)
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  processingText: {
    marginTop: 18,
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
  },

  // Success
  successIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#d1fae5',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, alignSelf: 'center',
  },
  successIconText: { fontSize: 28, color: '#059669', fontWeight: '700' },

  // Result card
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginVertical: 16,
  },
  resultRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  resultRowLabel: { fontSize: 13, color: '#6b7280' },
  resultRowValue: { fontSize: 13, fontWeight: '600', color: '#111827' },

  // Error
  errorIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#fee2e2',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, alignSelf: 'center',
  },
  errorIconText: { fontSize: 28, color: '#dc2626', fontWeight: '700' },
  errorCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 14,
    marginVertical: 16,
  },
  errorText: { fontSize: 13, color: '#b91c1c', lineHeight: 20 },
});
