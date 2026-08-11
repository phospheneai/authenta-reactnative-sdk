// Force Metro to bundle react-native-blob-util so @authenta/core can resolve it at runtime.
import 'react-native-blob-util';

export { AuthentaCapture } from './AuthentaCapture';
export { AuthentaFaceIndex } from './AuthentaFaceIndex';
export type { AuthentaCaptureProps, AuthentaFaceIndexProps } from './types';

// Re-export @authenta/core so apps only need @authenta/react-native — they can
// import AuthentaClient and FaceIndexClient from here too.
export * from '@authenta/core';
