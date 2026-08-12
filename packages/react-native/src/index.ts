// Force Metro to bundle react-native-blob-util so @authenta/core can resolve it at runtime.
import 'react-native-blob-util';

export { AuthentaCapture } from './AuthentaCapture';
export type { AuthentaCaptureProps } from './types';

// Re-export @authenta/core so apps only need @authenta/react-native — they can
// import AuthentaClient from here too.
export * from '@authenta/core';
