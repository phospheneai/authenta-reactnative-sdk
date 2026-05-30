/**
 * Shared test setup — import this in every test file.
 * Adjust API_KEY and file paths before running.
 */

import { AuthentaClient } from '../src';

export const API_KEY = 'API_KEY_HERE';
export const BASE_URL = 'https://platform.authenta.ai';

export const VIDEO_URI = 'file:///Volumes/Software/authenta-reactnative-sdk/data_samples/faceswap/real/1.mp4';
export const IMAGE_URI = 'file:///Volumes/Software/authenta-reactnative-sdk/data_samples/face_live_images/real/1.jpg';
export const SIMILARITY_IMAGE_URI = 'file:///Volumes/Software/authenta-reactnative-sdk/data_samples/face_similiar/person_1/A.jpeg';
export const REF_URI   = 'file:///Volumes/Software/authenta-reactnative-sdk/data_samples/face_similiar/person_1/B.jpeg';

export const TIMEOUT_MS = 600_000;

export function createClient(): AuthentaClient {
  return new AuthentaClient({ baseUrl: BASE_URL, api_key: API_KEY, auth_enabled: true });
}
