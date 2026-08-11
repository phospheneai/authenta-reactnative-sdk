/**
 * Public props and internal flow types for both modals.
 */

import type {
  AuthentaClient,
  AuthentaError,
  EnrollmentResult,
  FaceIndexClient,
  ModelType,
  ProcessedMedia,
  SearchResponse,
} from '@authenta/core';

// ─── Detection (AuthentaCapture) ──────────────────────────────────────────────

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
  /** Run the liveness check (photo). */
  livenessCheck?: boolean;
  /** Run the faceswap check (video). Cannot be combined with faceSimilarityCheck. */
  faceswapCheck?: boolean;
  /** Run the face similarity check (photo + reference image). */
  faceSimilarityCheck?: boolean;
}

/** The host app picks the checks, so capture opens straight into `busy`. */
export type CaptureStep = 'busy' | 'reference' | 'camera' | 'result' | 'error';

export type CaptureMode = 'photo' | 'video' | 'both';
export type CameraPosition = 'front' | 'back';

// ─── Face indexing (AuthentaFaceIndex) ────────────────────────────────────────

export interface AuthentaFaceIndexProps {
  /** Initialized FaceIndexClient — points at the FaceSim server, not Authenta. */
  client: FaceIndexClient;
  /** Controls modal visibility. */
  visible: boolean;
  /** Called when the user dismisses the modal. */
  onClose: () => void;
  /** Called once every enrolled face has settled as processed or failed. */
  onEnrolled?: (result: EnrollmentResult) => void;
  /** Called with the ranked matches each time a search completes. */
  onSearchResult?: (response: SearchResponse) => void;
  /** Called on validation, network, or API errors. */
  onError?: (error: Error | AuthentaError) => void;
  /** How many photos may be indexed at once. Defaults to 3. */
  maxImages?: number;
}

export type FaceIndexStep =
  | 'enroll' | 'busy' | 'enrolled' | 'source' | 'camera' | 'results' | 'error';

/** An image chosen from the library, before it is prepared for upload. */
export interface PickedImage {
  uri: string;
  name?: string;
  contentType?: string;
}
