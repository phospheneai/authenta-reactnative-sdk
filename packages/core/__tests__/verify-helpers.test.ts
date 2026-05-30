/**
 * Convenience wrappers: verify_deepfake, verify_liveness,
 * verify_similarity, verify_face_embeddings
 *
 * Each returns a DetectionResult directly (no job wrapper).
 *
 * Run:
 *   npx jest --testPathPattern=verify-helpers
 */

import { IMAGE_URI, VIDEO_URI, REF_URI, TIMEOUT_MS, createClient } from './setup';

const client = createClient();

describe('verify_deepfake()', () => {
  it('returns DetectionResult for a video', async () => {
    const result = await client.verify_deepfake(VIDEO_URI);
    console.log('isDeepFake :', result.isDeepFake);
    expect(result).toBeDefined();
  }, TIMEOUT_MS);

  it('throws ValidationError for an image', async () => {
    await expect(client.verify_deepfake(IMAGE_URI)).rejects.toThrow('verify_deepfake only accepts video files');
  });
});

describe('verify_liveness()', () => {
  it('returns DetectionResult for an image', async () => {
    const result = await client.verify_liveness(IMAGE_URI);
    console.log('isSpoof :', result.isSpoof);
    expect(result).toBeDefined();
  }, TIMEOUT_MS);
});

describe('verify_similarity()', () => {
  it('returns DetectionResult comparing two face images', async () => {
    const result = await client.verify_similarity(IMAGE_URI, REF_URI);
    console.log('isSimilar       :', result.isSimilar);
    console.log('similarityScore :', result.similarityScore);
    expect(result).toBeDefined();
  }, TIMEOUT_MS);

  it('throws ValidationError for a video', async () => {
    await expect(client.verify_similarity(VIDEO_URI, REF_URI)).rejects.toThrow('verify_similarity only accepts image files');
  });
});

describe('verify_face_embeddings()', () => {
  it('returns face embedding result for an image', async () => {
    const result = await client.verify_face_embeddings(IMAGE_URI);
    console.log('faceVector :', result.faceVector?.slice(0, 4), '...');
    expect(result).toBeDefined();
  }, TIMEOUT_MS);

  it('throws ValidationError for a video', async () => {
    await expect(client.verify_face_embeddings(VIDEO_URI)).rejects.toThrow('verify_face_embeddings only accepts image files');
  });
});
