/**
 * FI-1: Face liveness check (image)
 *
 * Run:
 *   npx jest --testPathPattern=fi1-liveness
 */

import { IMAGE_URI, TIMEOUT_MS, createClient } from './setup';

const client = createClient();

describe('FI-1 — Face Liveness', () => {
  describe('Single function: uploadAndPoll()', () => {
    it('checks liveness from an image', async () => {
      const result = await client.uploadAndPoll(IMAGE_URI, 'FI-1', { livenessCheck: true });
      console.log('id         :', (result as any).id);
      console.log('status     :', (result as any).status);
      console.log('isSpoof    :', (result as any).result?.isSpoof);

      expect((result as any).status).toMatch(/COMPLETED|PROCESSED/i);
    }, TIMEOUT_MS);
  });

  describe('Step by step: upload → pollResult → getResult', () => {
    it('uploads, polls, and fetches liveness result manually', async () => {
      const uploaded = await client.uploadAndPoll(IMAGE_URI, 'FI-1', {
        livenessCheck: true,
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
        console.log('isLiveness:', result.isLiveness);
        expect(result).toBeDefined();
      }
    }, TIMEOUT_MS);
  });
});
