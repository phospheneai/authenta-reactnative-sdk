/**
 * FI-1: Face similarity check (image + reference image)
 *
 * Run:
 *   npx jest --testPathPattern=fi1-similarity
 */

import { SIMILARITY_IMAGE_URI, REF_URI, TIMEOUT_MS, createClient } from './setup';

const client = createClient();

describe('FI-1 — Face Similarity', () => {
  describe('Single function: uploadAndPoll()', () => {
    it('compares a face against a reference image', async () => {
      const result = await client.uploadAndPoll(SIMILARITY_IMAGE_URI, 'FI-1', {
        faceSimilarityCheck: true,
        referenceImage: REF_URI,
      });
      console.log('id              :', (result as any).id);
      console.log('status          :', (result as any).status);
      console.log('isSimilar       :', (result as any).result?.isSimilar);
      console.log('similarityScore :', (result as any).result?.similarityScore);

      expect((result as any).status).toMatch(/COMPLETED|PROCESSED/i);
    }, TIMEOUT_MS);
  });

  describe('Step by step: upload → pollResult → getResult', () => {
    it('uploads, polls, and fetches similarity result manually', async () => {
      const uploaded = await client.uploadAndPoll(SIMILARITY_IMAGE_URI, 'FI-1', {
        faceSimilarityCheck: true,
        referenceImage: REF_URI,
        autoPolling: false,
      });
      const mid = (uploaded as any).job?.id ?? (uploaded as any).mid;
      console.log('uploaded — id:', mid);
      expect(mid).toBeTruthy();

      const media = await client.pollResult(mid);
      console.log('polled status:', media.status);
      expect(media.status).toMatch(/COMPLETED|PROCESSED/i);

      if (media.artifacts?.some(a => a.kind === 'result' && a.downloadUrl)) {
        const result = await client.getResult(media);
        console.log('isSimilar       :', result.isSimilar);
        console.log('similarityScore :', result.similarityScore);
        expect(result).toBeDefined();
      }
    }, TIMEOUT_MS);
  });
});
