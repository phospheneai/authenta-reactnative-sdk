export { AuthentaClient } from './client';
export type { AuthentaClientConfig } from './client';
export * from './types';
export * from './errors';
export { getMimeType, isImage, isVideo, safeJsonParse } from './utils/helpers';

// Face indexing — standalone FaceSim service, unrelated to the Authenta job API.
export * from './faceIndex';
