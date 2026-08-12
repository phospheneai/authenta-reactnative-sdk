/**
 * Public props and internal flow types.
 */

import type {
  AuthentaClient,
  EnrollResponse,
  ModelType,
  ProcessedMedia,
  SearchResponse,
} from '@authenta/core';

export interface AuthentaCaptureProps {
  /** Initialized AuthentaClient — one client serves both features. */
  client: AuthentaClient;
  /** Controls modal visibility. */
  visible: boolean;
  /** Called when the user dismisses the modal. */
  onClose: () => void;

  // ── The four toggles the host app owns ─────────────────────────────────────
  /** Run the liveness check (photo). */
  livenessCheck?: boolean;
  /** Run the faceswap check (video). */
  faceswapCheck?: boolean;
  /** Run the face similarity check (photo + reference image). */
  faceSimilarityCheck?: boolean;
  /** Index and search faces instead of running a detection model. */
  faceIndexing?: boolean;

  /** Reference photo for faceSimilarityCheck — the host app supplies it. */
  referenceImage?: string;
  /** Detection model to run. Defaults to 'FI-1'. */
  modelType?: ModelType;
  /** How many photos may be indexed at once. Defaults to 3. */
  maxImages?: number;

  // ── Results ────────────────────────────────────────────────────────────────
  /** Detection finished. */
  onResult?: (result: ProcessedMedia) => void;
  /** Faces uploaded for indexing. */
  onEnrolled?: (result: EnrollResponse) => void;
  /** A face search returned matches. */
  onSearchResult?: (result: SearchResponse) => void;
  /** Validation, capture, or API error. */
  onError?: (error: Error) => void;
}

export type CaptureMode = 'photo' | 'video' | 'both';
export type CameraPosition = 'front' | 'back';

/** Detection: camera → analyse → result. The host already chose the checks. */
export type DetectionStep = 'busy' | 'camera' | 'result' | 'error';

/** Face indexing: pick enrol or search, then a source for the photos. */
export type FaceIndexStep =
  | 'mode' | 'enroll' | 'source' | 'camera' | 'busy' | 'enrolled' | 'results' | 'error';

/** An image chosen from the library or captured, before upload. */
export interface PickedImage {
  uri: string;
  name?: string;
  contentType?: string;
}
