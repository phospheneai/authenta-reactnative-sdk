/**
 * AuthentaCapture — the one component a host app renders.
 *
 * The app owns four toggles and passes them in. `faceIndexing` selects an
 * entirely different feature, so it routes to its own flow; the detection
 * checks drive the camera flow. The two are mutually exclusive, and asking for
 * both surfaces a ValidationError rather than doing something ambiguous.
 *
 * Peer dependencies required in the host app:
 *   react-native-vision-camera >= 5
 *   react-native-image-picker  >= 7
 */

import React from 'react';

import { DetectionFlow } from './flows/detection';
import { FaceIndexFlow } from './flows/faceindex';
import type { AuthentaCaptureProps } from './types';

export type { AuthentaCaptureProps } from './types';

export function AuthentaCapture(props: AuthentaCaptureProps) {
  return props.faceIndexing
    ? <FaceIndexFlow {...props} />
    : <DetectionFlow {...props} />;
}
