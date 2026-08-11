/**
 * AuthentaFaceIndex — modal for the FaceSim face-indexing service.
 *
 * Enrol photos of one person, then search a new photo against everything
 * indexed for the tenant. Talks to FaceIndexClient only — it shares nothing
 * with AuthentaCapture beyond the camera screen and the presentational chrome.
 *
 * Flow: enroll → busy → enrolled → source → [camera] → busy → results | error
 */

import React, { useCallback, useState } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { useCameraPermission } from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';

import { AuthentaError } from '@authenta/core';
import type { EnrollmentResult, SearchResponse } from '@authenta/core';

import { CameraScreen } from './CameraScreen';
import { prepareEnrollmentImage, prepareSearchImage } from './media';
import { HIT_SLOP, s } from './theme';
import type { AuthentaFaceIndexProps, CameraPosition, FaceIndexStep, PickedImage } from './types';
import { Badge, Button, ErrorView, Outcome, Page, Row, Sheet, Spinner, useModalFlow } from './ui';

export type { AuthentaFaceIndexProps } from './types';

const TONE_FOR = { processed: 'ok', failed: 'bad' } as const;

export function AuthentaFaceIndex({
  client,
  visible,
  onClose,
  onEnrolled,
  onSearchResult,
  onError,
  maxImages = 3,
}: AuthentaFaceIndexProps) {
  const [images, setImages]         = useState<PickedImage[]>([]);
  const [enrollment, setEnrollment] = useState<EnrollmentResult | undefined>();
  const [matches, setMatches]       = useState<SearchResponse | undefined>();
  const [queryUri, setQueryUri]     = useState<string | undefined>();
  const [facing, setFacing]         = useState<CameraPosition>('back');
  const [session, setSession]       = useState(0);

  const camera = useCameraPermission();

  const flow = useModalFlow<FaceIndexStep>({
    visible,
    initial: 'enroll',
    onClose,
    onError,
    clear: () => {
      setImages([]);
      setEnrollment(undefined);
      setMatches(undefined);
      setQueryUri(undefined);
      setFacing('back');
    },
  });
  const { setStep, setBusy, fail, close, run, isOpen } = flow;

  /** Opens the library and returns the chosen assets. */
  const pick = useCallback((limit: number, onPicked: (picked: PickedImage[]) => void) => {
    launchImageLibrary({ mediaType: 'photo', selectionLimit: limit }, (res) => {
      if (res.didCancel) return;
      if (res.errorCode) {
        fail(new AuthentaError(`Image picker error: ${res.errorMessage ?? res.errorCode}`));
        return;
      }
      const picked = (res.assets ?? [])
        .filter(a => !!a.uri)
        .map(a => ({ uri: a.uri as string, name: a.fileName ?? undefined, contentType: a.type ?? undefined }));

      if (picked.length === 0) fail(new AuthentaError('No image was selected.'));
      else onPicked(picked);
    });
  }, [fail]);

  // ── Enrol ───────────────────────────────────────────────────────────────────

  const addImages = useCallback(() => {
    const remaining = maxImages - images.length;
    if (remaining <= 0) return;

    // Merge against the latest state — the picker resolves asynchronously.
    pick(remaining, picked => setImages(existing => {
      const seen = new Set(existing.map(i => i.uri));
      return [...existing, ...picked.filter(i => !seen.has(i.uri))].slice(0, maxImages);
    }));
  }, [images.length, maxImages, pick]);

  const enroll = useCallback(() => {
    if (images.length === 0) return;
    void run('Preparing photos…', async () => {
      const prepared = await Promise.all(images.map((img, i) => prepareEnrollmentImage(img, i)));

      setBusy('Uploading photos…');
      const created = await client.enrollImages(prepared);

      setBusy('Indexing faces…');
      const result = await client.waitForEnrollment(created.subject_id);

      if (!isOpen.current) return;
      setImages([]); // consumed — leave the upload page empty for the next subject
      setEnrollment(result);
      setStep('enrolled');
      onEnrolled?.(result);
    });
  }, [images, client, onEnrolled, run, setBusy, setStep, isOpen]);

  // ── Search ──────────────────────────────────────────────────────────────────

  const search = useCallback((uri: string) => {
    setQueryUri(uri);
    void run('Matching face…', async () => {
      const response = await client.search(await prepareSearchImage(uri));

      if (!isOpen.current) return;
      setMatches(response);
      setStep('results');
      onSearchResult?.(response);
    });
  }, [client, onSearchResult, run, setStep, isOpen]);

  const searchFromCamera = useCallback(async () => {
    if (!camera.hasPermission && !(await camera.requestPermission())) {
      fail(new AuthentaError('Camera permission is required.'));
      return;
    }
    setSession(k => k + 1);
    setStep('camera');
  }, [camera, fail, setStep]);

  // The upload page is home for both features, so everything returns there.
  const goHome = useCallback(() => setStep('enroll'), [setStep]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const remaining = maxImages - images.length;

  return (
    <Sheet visible={visible} onRequestClose={close}>
      {flow.step === 'busy' && <Spinner message={flow.busy} />}

      {flow.step === 'enroll' && (
        <Page
          title="Face Indexing"
          subtitle={`Index up to ${maxImages} photos of one person, or search for a face that is already indexed.`}
          onClose={close}
        >
          <View style={s.grid}>
            {images.map(image => (
              <View key={image.uri} style={s.tileWrap}>
                <Image source={{ uri: image.uri }} style={s.tile} resizeMode="cover" />
                <TouchableOpacity
                  style={s.tileX}
                  hitSlop={HIT_SLOP}
                  onPress={() => setImages(cur => cur.filter(i => i.uri !== image.uri))}
                >
                  <Text style={s.tileXText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {remaining > 0 && (
              <TouchableOpacity style={s.slot} onPress={addImages}>
                <Text style={s.slotText}>＋</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={s.hint}>
            {remaining > 0
              ? `${images.length} of ${maxImages} selected — JPEG, PNG, or WebP. HEIC photos are converted automatically.`
              : `${maxImages} of ${maxImages} selected — remove one to swap it out.`}
          </Text>

          <Button
            label={images.length > 0 ? `Index ${images.length} Photo${images.length > 1 ? 's' : ''}` : 'Index Photos'}
            onPress={enroll}
            disabled={images.length === 0}
          />

          {/* Search stands on its own — it matches against everything already
              indexed for the tenant, not just this session's upload. */}
          <Text style={s.hint}>Or match a photo against the faces already indexed.</Text>
          <Button label="Search a Face" kind="secondary" onPress={() => setStep('source')} />
        </Page>
      )}

      {flow.step === 'enrolled' && enrollment && (
        <Page
          title={enrollment.processedCount === 0 ? 'Indexing Failed' : 'Faces Indexed'}
          subtitle={`${enrollment.processedCount} of ${enrollment.faces.length} photo${enrollment.faces.length === 1 ? '' : 's'} indexed` +
            (enrollment.failedCount > 0 ? ` — ${enrollment.failedCount} could not be read.` : '.')}
        >
          <Outcome ok={enrollment.processedCount > 0} />
          <Text style={s.mono}>Subject ID: {enrollment.subject_id}</Text>

          <View style={s.card}>
            {enrollment.faces.map((face, i) => (
              <Row
                key={face.face_id}
                first={i === 0}
                thumb={face.image_url}
                title={face.name}
                meta="Ready to match against"
                error={face.error}
                right={<Badge label={face.status} tone={TONE_FOR[face.status as keyof typeof TONE_FOR] ?? 'pending'} />}
              />
            ))}
          </View>

          <Button label="Index More Photos" onPress={goHome} />
          <Button label="Done" kind="secondary" onPress={close} />
        </Page>
      )}

      {flow.step === 'source' && (
        <Page
          scroll={false}
          title="Search a Face"
          subtitle="Choose a photo to match against the indexed faces."
          onClose={close}
        >
          <View style={s.card}>
            <Row
              first
              icon="📷"
              title="Take a Photo"
              meta="Capture a face with the camera"
              onPress={searchFromCamera}
            />
            <Row
              icon="🖼"
              title="Choose from Library"
              meta="Pick an existing photo"
              onPress={() => pick(1, picked => search(picked[0].uri))}
            />
          </View>
          <Button label="Back" kind="secondary" onPress={goHome} />
        </Page>
      )}

      {flow.step === 'camera' && (
        <CameraScreen
          key={session}
          captureMode="photo"
          cameraPosition={facing}
          retryCount={0}
          onCaptured={search}
          onError={fail}
          onBack={() => setStep('source')}
          onSwitchCamera={() => setFacing(p => p === 'front' ? 'back' : 'front')}
        />
      )}

      {flow.step === 'results' && matches && (
        <Page
          title="Search Results"
          subtitle={matches.count === 0
            ? 'No indexed face matched this photo.'
            : `${matches.count} match${matches.count === 1 ? '' : 'es'}, strongest first.`}
          onClose={close}
        >
          {queryUri && (
            <View style={s.preview}>
              <Image source={{ uri: queryUri }} style={s.thumb} resizeMode="cover" />
            </View>
          )}

          <View style={s.card}>
            {matches.count === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyText}>
                  Index more photos of this person, or search with a clearer,
                  front-facing photo.
                </Text>
              </View>
            ) : matches.results.map((match, i) => (
              <Row
                key={match.face_id}
                first={i === 0}
                lead={<View style={s.rank}><Text style={s.rankText}>{match.rank}</Text></View>}
                thumb={match.image_url}
                title={match.name}
                meta={`Subject ${match.subject_id.slice(0, 8)}…`}
                right={<Text style={s.score}>{(match.similarity_score * 100).toFixed(1)}%</Text>}
              />
            ))}
          </View>

          <Button label="Search Another Face" onPress={() => setStep('source')} />
          <Button label="Back" kind="secondary" onPress={goHome} />
        </Page>
      )}

      {flow.step === 'error' && (
        <ErrorView
          error={flow.error}
          onRetry={goHome}
          onClose={close}
          closeLabel="Close"
        />
      )}
    </Sheet>
  );
}
