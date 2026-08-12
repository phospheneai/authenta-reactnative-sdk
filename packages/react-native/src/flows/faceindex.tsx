/**
 * Face indexing flow — index a person's photos, or search for a face.
 *
 * Both halves take their photos from the camera or the library.
 *
 * mode → enroll → busy → enrolled
 *      → source → camera → busy → results
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { useCameraPermission } from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';

import { AuthentaError, ValidationError } from '@authenta/core';
import type { EnrollResponse, SearchResponse } from '@authenta/core';

import { CameraScreen } from '../CameraScreen';
import { prepareEnrollmentImage } from '../media';
import { HIT_SLOP, s } from '../theme';
import type { AuthentaCaptureProps, CameraPosition, FaceIndexStep, PickedImage } from '../types';
import { Badge, Button, ErrorView, Outcome, Page, Row, Sheet, Spinner, useModalFlow } from '../ui';

const TONE_FOR = { processed: 'ok', failed: 'bad' } as const;

export function FaceIndexFlow({
  client,
  visible,
  onClose,
  onEnrolled,
  onSearchResult,
  onError,
  maxImages = 3,
  livenessCheck,
  faceswapCheck,
  faceSimilarityCheck,
}: AuthentaCaptureProps) {
  const [images, setImages] = useState<PickedImage[]>([]);
  const [enrolled, setEnrolled] = useState<EnrollResponse | undefined>();
  const [matches, setMatches] = useState<SearchResponse | undefined>();
  const [queryUri, setQueryUri] = useState<string | undefined>();
  const [facing, setFacing] = useState<CameraPosition>('back');
  const [session, setSession] = useState(0);
  // Whether the next camera capture is another enrolment photo or a search.
  const [intent, setIntent] = useState<'enroll' | 'search'>('enroll');

  const camera = useCameraPermission();

  const flow = useModalFlow<FaceIndexStep>({
    visible,
    initial: 'mode',
    onClose,
    onError,
    clear: () => {
      setImages([]);
      setEnrolled(undefined);
      setMatches(undefined);
      setQueryUri(undefined);
      setFacing('back');
      setIntent('enroll');
    },
  });
  const { setStep, fail, close, run, isOpen } = flow;

  // Face indexing runs no detection model, so the two cannot be combined.
  useEffect(() => {
    if (visible && (livenessCheck || faceswapCheck || faceSimilarityCheck)) {
      fail(new ValidationError(
        'faceIndexing cannot be combined with detection checks — ' +
        'turn off livenessCheck, faceswapCheck, and faceSimilarityCheck.',
      ));
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Opens the library and hands back the chosen assets. */
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

  const openCamera = useCallback(async (next: 'enroll' | 'search') => {
    if (!camera.hasPermission && !(await camera.requestPermission())) {
      fail(new AuthentaError('Camera permission is required.'));
      return;
    }
    setIntent(next);
    setSession(k => k + 1);
    setStep('camera');
  }, [camera, fail, setStep]);

  // ── Enrol ──────────────────────────────────────────────────────────────────

  const addImages = useCallback((picked: PickedImage[]) => {
    setImages(existing => {
      const seen = new Set(existing.map(i => i.uri));
      return [...existing, ...picked.filter(i => !seen.has(i.uri))].slice(0, maxImages);
    });
  }, [maxImages]);

  const enroll = useCallback(() => {
    if (images.length === 0) return;
    void run('Uploading photos…', async () => {
      const prepared = await Promise.all(images.map((img, i) => prepareEnrollmentImage(img, i)));
      const created = await client.faceEnrol(prepared);

      if (!isOpen.current) return;
      setImages([]);
      setEnrolled(created);
      setStep('enrolled');
      onEnrolled?.(created);
    });
  }, [images, client, onEnrolled, run, setStep, isOpen]);

  // ── Search ─────────────────────────────────────────────────────────────────

  const search = useCallback((uri: string) => {
    setQueryUri(uri);
    void run('Matching face…', async () => {
      // Sent exactly as captured — nothing re-encodes the photo.
      const response = await client.faceSearch(uri);

      if (!isOpen.current) return;
      setMatches(response);
      setStep('results');
      onSearchResult?.(response);
    });
  }, [client, onSearchResult, run, setStep, isOpen]);

  const onCaptured = useCallback((uri: string) => {
    if (intent === 'search') search(uri);
    else {
      addImages([{ uri }]);
      setStep('enroll');
    }
  }, [intent, search, addImages, setStep]);

  const remaining = maxImages - images.length;

  return (
    <Sheet visible={visible} onRequestClose={close}>
      {flow.step === 'busy' && <Spinner message={flow.busy} />}

      {flow.step === 'mode' && (
        <Page
          scroll={false}
          title="Face Indexing"
          subtitle="Index a person's photos so their face can be found later, or search for a face that is already indexed."
          onClose={close}
        >
          <View style={s.card}>
            <Row first icon="👤" title="Index a Face" meta={`Add up to ${maxImages} photos of one person`}
              onPress={() => setStep('enroll')} />
            <Row icon="🔍" title="Search a Face" meta="Match a photo against indexed faces"
              onPress={() => setStep('source')} />
          </View>
        </Page>
      )}

      {flow.step === 'enroll' && (
        <Page
          title="Index a Face"
          subtitle={`Add up to ${maxImages} photos of the same person. They are indexed together as one subject.`}
          onClose={close}
        >
          <View style={s.grid}>
            {images.map(image => (
              <View key={image.uri} style={s.tileWrap}>
                <Image source={{ uri: image.uri }} style={s.tile} resizeMode="cover" />
                <TouchableOpacity style={s.tileX} hitSlop={HIT_SLOP}
                  onPress={() => setImages(cur => cur.filter(i => i.uri !== image.uri))}>
                  <Text style={s.tileXText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <Text style={s.hint}>
            {remaining > 0
              ? `${images.length} of ${maxImages} selected — JPEG, PNG, or WebP. HEIC photos are converted automatically.`
              : `${maxImages} of ${maxImages} selected — remove one to swap it out.`}
          </Text>

          {remaining > 0 && (
            <View style={s.card}>
              <Row first icon="📷" title="Take a Photo" onPress={() => void openCamera('enroll')} />
              <Row icon="🖼" title="Choose from Library" onPress={() => pick(remaining, addImages)} />
            </View>
          )}

          <Button
            label={images.length > 0 ? `Index ${images.length} Photo${images.length > 1 ? 's' : ''}` : 'Index Photos'}
            onPress={enroll}
            disabled={images.length === 0}
          />
          <Button label="Back" kind="secondary" onPress={() => setStep('mode')} />
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
            <Row first icon="📷" title="Take a Photo" meta="Capture a face with the camera"
              onPress={() => void openCamera('search')} />
            <Row icon="🖼" title="Choose from Library" meta="Pick an existing photo"
              onPress={() => pick(1, picked => search(picked[0].uri))} />
          </View>
          <Button label="Back" kind="secondary" onPress={() => setStep('mode')} />
        </Page>
      )}

      {flow.step === 'camera' && (
        <CameraScreen
          key={session}
          captureMode="photo"
          cameraPosition={facing}
          retryCount={0}
          onCaptured={onCaptured}
          onError={fail}
          onBack={() => setStep(intent === 'search' ? 'source' : 'enroll')}
          onSwitchCamera={() => setFacing(p => p === 'front' ? 'back' : 'front')}
        />
      )}

      {flow.step === 'enrolled' && enrolled && (
        <Page
          title="Faces Indexed"
          subtitle={`${enrolled.faces.length} photo${enrolled.faces.length === 1 ? '' : 's'} uploaded. Embeddings are generated in the background.`}
        >
          <Outcome ok />
          <Text style={s.mono}>Subject ID: {enrolled.subject_id}</Text>

          <View style={s.card}>
            {enrolled.faces.map((face, i) => (
              <Row key={face.face_id} first={i === 0} title={face.face_id}
                meta="Uploaded"
                right={<Badge label={face.status} tone={TONE_FOR[face.status as keyof typeof TONE_FOR] ?? 'pending'} />} />
            ))}
          </View>

          <Button label="Index More Photos" onPress={() => setStep('enroll')} />
          <Button label="Search a Face" kind="secondary" onPress={() => setStep('source')} />
          <Button label="Done" kind="secondary" onPress={close} />
        </Page>
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
                  Index more photos of this person, or search with a clearer, front-facing photo.
                </Text>
              </View>
            ) : matches.results.map((match, i) => (
              <Row key={match.face_id} first={i === 0}
                lead={<View style={s.rank}><Text style={s.rankText}>{match.rank}</Text></View>}
                thumb={match.image_url}
                title={match.name}
                meta={`Subject ${match.subject_id.slice(0, 8)}…`}
                right={<Text style={s.score}>{(match.similarity_score * 100).toFixed(1)}%</Text>} />
            ))}
          </View>

          <Button label="Search Another Face" onPress={() => setStep('source')} />
          <Button label="Back" kind="secondary" onPress={() => setStep('mode')} />
        </Page>
      )}

      {flow.step === 'error' && (
        <ErrorView error={flow.error} onRetry={() => setStep('mode')} onClose={close} closeLabel="Close" />
      )}
    </Sheet>
  );
}
