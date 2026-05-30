/**
 * FI-1: Face swap / deepfake check (video)
 *
 * Run:
 *   npx jest --testPathPattern=fi1-faceswap
 */

import { VIDEO_URI, TIMEOUT_MS, createClient } from './setup';

const client = createClient();

describe('FI-1 — Face Swap Detection', () => {
  describe('Single function: uploadAndPoll()', () => {
    it('checks face swap in a video', async () => {
      const result = await client.uploadAndPoll(VIDEO_URI, 'FI-1', { faceswapCheck: true });
      console.log('id         :', (result as any).id);
      console.log('status     :', (result as any).status);
      console.log('isDeepFake :', (result as any).result?.isDeepFake);

      expect((result as any).status).toMatch(/COMPLETED|PROCESSED/i);
    }, TIMEOUT_MS);
  });

  describe('Step by step: upload → pollResult → getResult', () => {
    it('uploads, polls, and fetches faceswap result manually', async () => {
      const uploaded = await client.uploadAndPoll(VIDEO_URI, 'FI-1', {
        faceswapCheck: true,
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
        console.log('isDeepFake:', result.isDeepFake);
        expect(result).toBeDefined();
      }
    }, TIMEOUT_MS);
  });
});
