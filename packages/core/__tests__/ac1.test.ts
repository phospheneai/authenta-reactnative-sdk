/**
 * AC-1: AI-generated image detection
 *
 * Run:
 *   npx jest --testPathPattern=ac1
 */

import { AuthentaClient } from '../src';
import { IMAGE_URI, TIMEOUT_MS, createClient } from './setup';

const client = createClient();

describe('AC-1 — AI-Generated Image Detection', () => {
  describe('Single function: uploadAndPoll()', () => {
    it('detects AI-generated content in an image', async () => {
      const result = await client.uploadAndPoll(IMAGE_URI, 'AC-1');
      console.log('id     :', (result as any).id);
      console.log('status :', (result as any).status);
      console.log('result :', (result as any).result);

      expect((result as any).status).toMatch(/COMPLETED|PROCESSED/i);
    }, TIMEOUT_MS);
  });

  describe('Step by step: upload → pollResult → getResult', () => {
    it('uploads, polls, and fetches result manually', async () => {
      const uploaded = await client.uploadAndPoll(IMAGE_URI, 'AC-1', { autoPolling: false });
      const mid = (uploaded as any).job?.id ?? (uploaded as any).mid;
      console.log('uploaded — id:', mid);
      expect(mid).toBeTruthy();

      const media = await client.pollResult(mid);
      console.log('polled status:', media.status);
      expect(media.status).toMatch(/COMPLETED|PROCESSED/i);

      if (media.artifacts?.some(a => a.kind === 'result' && a.downloadUrl)) {
        const result = await client.getResult(media);
        console.log('result:', result);
        expect(result).toBeDefined();
      }
    }, TIMEOUT_MS);
  });
});
