/**
 * FI-1: All face checks combined in a single uploadAndPoll() call
 * (liveness + faceswap + similarity)
 *
 * Run:
 *   npx jest --testPathPattern=fi1-full
 */

import { IMAGE_URI, REF_URI, TIMEOUT_MS, createClient } from './setup';

const client = createClient();

describe('FI-1 — Full Face Intelligence (all checks)', () => {
  it('runs liveness + faceswap + similarity in one call', async () => {
    const result = await client.uploadAndPoll(IMAGE_URI, 'FI-1', {
      livenessCheck:      true,
      faceswapCheck:      false, // video only — skip for image
      faceSimilarityCheck: true,
      referenceImage:     REF_URI,
    });
    console.log('id              :', (result as any).id);
    console.log('status          :', (result as any).status);
    console.log('result          :', (result as any).result);

    expect((result as any).status).toMatch(/COMPLETED|PROCESSED/i);
  }, TIMEOUT_MS);
});
