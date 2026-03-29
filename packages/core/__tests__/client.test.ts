/**
 * Authenta SDK – manual integration test
 *
 * Two modes:
 *   1. Single function  — client.faceIntelligence()  handles everything in one call
 *   2. Step by step     — createMedia → upload → pollResult → getResult manually
 *
 * Flip the TEST flags to choose what to run, then:
 *   npx ts-node __tests__/client.test.ts
 */

import { AuthentaClient, AuthentaError } from '../src';

// ─── SDK setup ───────────────────────────────────────────────────────────────

const client = new AuthentaClient({
  baseUrl: 'https://platform.authenta.ai',
  clientId: '<CLIENT_ID>',
  clientSecret: '<CLIENT_SECRET>',
});

// ─── File paths ───────────────────────────────────────────────────────────────

const VIDEO_URI = 'file:///Volumes/Software/authenta-reactnative-sdk/data_samples/faceswap/real/1.mp4';
const IMAGE_URI = 'file:///Volumes/Software/authenta-reactnative-sdk/data_samples/face_live_images/real/1.jpg';
const REF_URI   = 'file:///Volumes/Software/authenta-reactnative-sdk/data_samples/face_similiar/person_1/B.jpeg';

// ─── Toggle which tests to run ────────────────────────────────────────────────

const TEST = {
  // ── Single function ──────────────────────────────────────────────────────
  single: {
    fi1:            true,  // Face Intelligence — all checks in one go (liveness + faceswap + similarity)
    df1:            false, // Deepfake — video
    ac1:            false, // AI-generated image check
    fi1_liveness:   true,  // Face liveness — image
    fi1_faceswap:   false, // Face swap — video
    fi1_similarity: false, // Face similarity — image + reference
  },

  // ── Step by step ─────────────────────────────────────────────────────────
  steps: {
    df1:            false,
    ac1:            false,
    fi1_liveness:   false,
    fi1_faceswap:   false,
    fi1_similarity: false,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SINGLE FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

async function singleFunctionTests() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║  SINGLE FUNCTION: client.faceIntelligence()  ║');
  console.log('╚══════════════════════════════════════╝');

  if (TEST.single.df1) {
    console.log('\n── DF-1: Deepfake detection ─────────────────────────────────');
    const result = await client.faceIntelligence(VIDEO_URI, 'DF-1');
    console.log('mid    :', result.mid);
    console.log('status :', result.status);
    console.log('result :', result.result);
  }

  if (TEST.single.ac1) {
    console.log('\n── AC-1: AI-generated image check ──────────────────────────');
    const result = await client.faceIntelligence(IMAGE_URI, 'AC-1');
    console.log('mid    :', result.mid);
    console.log('status :', result.status);
    console.log('result :', result.result);
  }

  if (TEST.single.fi1) {
    console.log('\n── FI-1: Face Intelligence check ────────────────────────────');
    const result = await client.faceIntelligence(IMAGE_URI, 'FI-1', {
      livenessCheck:      TEST.single.fi1_liveness,
      faceswapCheck:      TEST.single.fi1_faceswap,
      faceSimilarityCheck: TEST.single.fi1_similarity,
      referenceImage:     TEST.single.fi1_similarity ? REF_URI : undefined,
    });
    console.log('mid    :', result.mid);
    console.log('status :', result.status);
    console.log('result :', result.result);
  }

  if (TEST.single.fi1_liveness) {
    console.log('\n── FI-1: Liveness check ─────────────────────────────────────');
    const result = await client.faceIntelligence(IMAGE_URI, 'FI-1', { livenessCheck: true });
    console.log('mid        :', result.mid);
    console.log('status     :', result.status);
    console.log('isLiveness :', result.result?.isLiveness);
  }

  if (TEST.single.fi1_faceswap) {
    console.log('\n── FI-1: Faceswap check ─────────────────────────────────────');
    const result = await client.faceIntelligence(VIDEO_URI, 'FI-1', { faceswapCheck: true });
    console.log('mid        :', result.mid);
    console.log('status     :', result.status);
    console.log('isDeepFake :', result.result?.isDeepFake);
  }

  if (TEST.single.fi1_similarity) {
    console.log('\n── FI-1: Face similarity ────────────────────────────────────');
    const result = await client.faceIntelligence(IMAGE_URI, 'FI-1', {
      faceSimilarityCheck: true,
      referenceImage: REF_URI,
    });
    console.log('mid             :', result.mid);
    console.log('status          :', result.status);
    console.log('isSimilar       :', result.result?.isSimilar);
    console.log('similarityScore :', result.result?.similarityScore);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. STEP BY STEP
// ═══════════════════════════════════════════════════════════════════════════════

async function stepByStepTests() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  STEP BY STEP: upload → pollResult → getResult            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  if (TEST.steps.df1) {
    console.log('\n── DF-1: step by step ───────────────────────────────────────');
    const uploaded = await client.faceIntelligence(VIDEO_URI, 'DF-1', { autoPolling: false });
    console.log('uploaded — mid    :', uploaded.mid);
    const media = await client.pollResult(uploaded.mid);
    if (media.resultURL) {
      const result = await client.getResult(media);
      console.log('result :', result);
    }
  }

  if (TEST.steps.ac1) {
    console.log('\n── AC-1: step by step ───────────────────────────────────────');
    const uploaded = await client.faceIntelligence(IMAGE_URI, 'AC-1', { autoPolling: false });
    const media = await client.pollResult(uploaded.mid);
    if (media.resultURL) {
      const result = await client.getResult(media);
      console.log('result :', result);
    }
  }

  if (TEST.steps.fi1_liveness) {
    console.log('\n── FI-1 liveness: step by step ──────────────────────────────');
    const uploaded = await client.faceIntelligence(IMAGE_URI, 'FI-1', {
      livenessCheck: true,
      autoPolling: false,
    });
    const media = await client.pollResult(uploaded.mid);
    if (media.resultURL) {
      const result = await client.getResult(media);
      console.log('isLiveness :', result.isLiveness);
    }
  }

  if (TEST.steps.fi1_faceswap) {
    console.log('\n── FI-1 faceswap: step by step ──────────────────────────────');
    const uploaded = await client.faceIntelligence(VIDEO_URI, 'FI-1', {
      faceswapCheck: true,
      autoPolling: false,
    });
    const media = await client.pollResult(uploaded.mid);
    if (media.resultURL) {
      const result = await client.getResult(media);
      console.log('isDeepFake :', result.isDeepFake);
    }
  }

  if (TEST.steps.fi1_similarity) {
    console.log('\n── FI-1 similarity: step by step ────────────────────────────');
    const uploaded = await client.faceIntelligence(IMAGE_URI, 'FI-1', {
      faceSimilarityCheck: true,
      referenceImage: REF_URI,
      autoPolling: false,
    });
    const media = await client.pollResult(uploaded.mid);
    if (media.resultURL) {
      const result = await client.getResult(media);
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

main().catch(err => {
  if (err instanceof AuthentaError) {
    console.error(`\n[${err.name}] ${err.message} (code=${err.code}, status=${err.statusCode})`);
  } else {
    console.error('\n', err);
  }
  process.exit(1);
});
