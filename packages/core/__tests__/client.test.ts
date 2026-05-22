/**
 * Authenta SDK – manual integration test
 *
 * Two modes:
 *   1. Single function  — client.uploadAndPoll()  handles everything in one call
 *   2. Step by step     — createJob → upload → pollResult → getResult manually
 *
 * Flip the TEST flags to choose what to run, then:
 *   npx ts-node __tests__/client.test.ts
 */

import { AuthentaClient, AuthentaError } from '../src';

// ─── SDK setup ───────────────────────────────────────────────────────────────

const client = new AuthentaClient({
  baseUrl: 'https://platform.authenta.ai',
  apiKey: '<API_KEY>',
});

// ─── File paths ───────────────────────────────────────────────────────────────

const VIDEO_URI = 'file:///Volumes/Software/authenta-reactnative-sdk/data_samples/faceswap/real/1.mp4';
const IMAGE_URI = 'file:///Volumes/Software/authenta-reactnative-sdk/data_samples/face_live_images/real/1.jpg';
const REF_URI   = 'file:///Volumes/Software/authenta-reactnative-sdk/data_samples/face_similiar/person_1/B.jpeg';

// ─── Toggle which tests to run ────────────────────────────────────────────────

const TEST = {
  // ── Single function ──────────────────────────────────────────────────────
  single: {
    fi:             true,  // Face Intelligence (taskTypeId 8) — liveness + faceswap + similarity
    df:             false, // Faceswap detection (taskTypeId 4) — video
    ac:             false, // AI image detection (taskTypeId 1) — image
    fi_liveness:    true,  // Face intelligence — liveness check
    fi_faceswap:    false, // Face intelligence — faceswap check (video)
    fi_similarity:  false, // Face intelligence — similarity check (image + reference)
    fe:             false, // Face embeddings (taskTypeId 9) — image
  },

  // ── Step by step ─────────────────────────────────────────────────────────
  steps: {
    df:             false,
    ac:             false,
    fi_liveness:    false,
    fi_faceswap:    false,
    fi_similarity:  false,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SINGLE FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

async function singleFunctionTests() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║  SINGLE FUNCTION: client.uploadAndPoll()  ║');
  console.log('╚══════════════════════════════════════╝');

  if (TEST.single.df) {
    console.log('\n── taskTypeId 4: Faceswap detection ────────────────────────');
    const result = await client.uploadAndPoll(VIDEO_URI, '4');
    console.log('id     :', result.id);
    console.log('status :', result.status);
    console.log('result :', result.result);
  }

  if (TEST.single.ac) {
    console.log('\n── taskTypeId 1: AI image detection ────────────────────────');
    const result = await client.uploadAndPoll(IMAGE_URI, '1');
    console.log('id     :', result.id);
    console.log('status :', result.status);
    console.log('result :', result.result);
  }

  if (TEST.single.fi) {
    console.log('\n── taskTypeId 8: Face Intelligence ──────────────────────────');
    const result = await client.uploadAndPoll(IMAGE_URI, '8', {
      isLivenessCheck:   TEST.single.fi_liveness,
      isFaceswapCheck:   TEST.single.fi_faceswap,
      isSimilarityCheck: TEST.single.fi_similarity,
      referenceImage:    TEST.single.fi_similarity ? REF_URI : undefined,
    });
    console.log('id     :', result.id);
    console.log('status :', result.status);
    console.log('result :', result.result);
  }

  if (TEST.single.fi_liveness) {
    console.log('\n── taskTypeId 8: Liveness check ─────────────────────────────');
    const result = await client.uploadAndPoll(IMAGE_URI, '8', { isLivenessCheck: true });
    console.log('id         :', result.id);
    console.log('status     :', result.status);
    console.log('isLiveness :', result.result?.isLiveness);
  }

  if (TEST.single.fi_faceswap) {
    console.log('\n── taskTypeId 8: Faceswap check ─────────────────────────────');
    const result = await client.uploadAndPoll(VIDEO_URI, '8', { isFaceswapCheck: true });
    console.log('id         :', result.id);
    console.log('status     :', result.status);
    console.log('isDeepFake :', result.result?.isDeepFake);
  }

  if (TEST.single.fi_similarity) {
    console.log('\n── taskTypeId 8: Face similarity ────────────────────────────');
    const result = await client.uploadAndPoll(IMAGE_URI, '8', {
      isSimilarityCheck: true,
      referenceImage: REF_URI,
    });
    console.log('id              :', result.id);
    console.log('status          :', result.status);
    console.log('isSimilar       :', result.result?.isSimilar);
    console.log('similarityScore :', result.result?.similarityScore);
  }

  if (TEST.single.fe) {
    console.log('\n── taskTypeId 9: Face embeddings ────────────────────────────');
    const result = await client.uploadAndPoll(IMAGE_URI, '9');
    console.log('id         :', result.id);
    console.log('status     :', result.status);
    console.log('faceVector :', result.result?.faceVector);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. STEP BY STEP
// ═══════════════════════════════════════════════════════════════════════════════

async function stepByStepTests() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  STEP BY STEP: upload → pollResult → getResult            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  if (TEST.steps.df) {
    console.log('\n── taskTypeId 4: step by step ───────────────────────────────');
    const uploaded = await client.uploadAndPoll(VIDEO_URI, '4', { autoPolling: false });
    console.log('uploaded — id :', uploaded.id);
    const job = await client.pollResult(uploaded.id);
    if (job.resultURL) {
      const result = await client.getResult(job);
      console.log('result :', result);
    }
  }

  if (TEST.steps.ac) {
    console.log('\n── taskTypeId 1: step by step ───────────────────────────────');
    const uploaded = await client.uploadAndPoll(IMAGE_URI, '1', { autoPolling: false });
    const job = await client.pollResult(uploaded.id);
    if (job.resultURL) {
      const result = await client.getResult(job);
      console.log('result :', result);
    }
  }

  if (TEST.steps.fi_liveness) {
    console.log('\n── taskTypeId 8 liveness: step by step ──────────────────────');
    const uploaded = await client.uploadAndPoll(IMAGE_URI, '8', {
      isLivenessCheck: true,
      autoPolling: false,
    });
    const job = await client.pollResult(uploaded.id);
    if (job.resultURL) {
      const result = await client.getResult(job);
      console.log('isLiveness :', result.isLiveness);
    }
  }

  if (TEST.steps.fi_faceswap) {
    console.log('\n── taskTypeId 8 faceswap: step by step ──────────────────────');
    const uploaded = await client.uploadAndPoll(VIDEO_URI, '8', {
      isFaceswapCheck: true,
      autoPolling: false,
    });
    const job = await client.pollResult(uploaded.id);
    if (job.resultURL) {
      const result = await client.getResult(job);
      console.log('isDeepFake :', result.isDeepFake);
    }
  }

  if (TEST.steps.fi_similarity) {
    console.log('\n── taskTypeId 8 similarity: step by step ────────────────────');
    const uploaded = await client.uploadAndPoll(IMAGE_URI, '8', {
      isSimilarityCheck: true,
      referenceImage: REF_URI,
      autoPolling: false,
    });
    const job = await client.pollResult(uploaded.id);
    if (job.resultURL) {
      const result = await client.getResult(job);
      console.log('isSimilar       :', result.isSimilar);
      console.log('similarityScore :', result.similarityScore);
    }
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

async function main() {
  const anySingle = Object.values(TEST.single).some(Boolean);
  const anySteps  = Object.values(TEST.steps).some(Boolean);

  if (!anySingle && !anySteps) {
    console.log('No tests enabled. Flip a flag in the TEST object to run something.');
    return;
  }

  if (anySingle) await singleFunctionTests();
  if (anySteps)  await stepByStepTests();

  console.log('\n✓ All selected tests completed.\n');
}

if (typeof describe === 'function' && typeof it === 'function') {
  describe('Manual Integration', () => {
    it('runs end-to-end against the live API', async () => {
      await main();
    }, 600_000);
  });
} else {
  main().catch(err => {
    if (err instanceof AuthentaError) {
      console.error(`\n[${err.name}] ${err.message} (code=${err.code}, status=${err.statusCode})`);
    } else {
      console.error('\n', err);
    }
    process.exit(1);
  });
}
