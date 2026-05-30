/**
 * Low-level API methods: createMedia, getMedia, listMedia, deleteMedia, get_task_id
 *
 * Run:
 *   npx jest --testPathPattern=media-crud
 */

import { IMAGE_URI, TIMEOUT_MS, createClient } from './setup';

const client = createClient();

describe('get_task_id()', () => {
  it.each([
    ['AC-1', '1'],
    ['AF-1', '2'],
    ['VF-1', '3'],
    ['DF-1', '4'],
    ['FD-1', '5'],
    ['DI-1', '6'],
    ['FL-1', '7'],
    ['FI-1', '8'],
    ['FE-1', '9'],
  ])('maps %s → %s', async (model, expectedId) => {
    const id = await client.get_task_id(model);
    expect(id).toBe(expectedId);
  });

  it('throws ValidationError for unknown model', async () => {
    await expect(client.get_task_id('XX-9')).rejects.toThrow('Unsupported modelType');
  });
});

describe('createMedia()', () => {
  it('creates a job and returns upload URLs', async () => {
    const resp = await client.createMedia({
      taskTypeId: '8',
      inputs: [{
        slotName: 'original',
        contentType: 'image/jpeg',
        fileName: 'test.jpg',
        sizeBytes: 100_000,
      }],
      parameters: { isLivenessCheck: true, isFaceswapCheck: false, isSimilarityCheck: false },
    });

    console.log('job.id     :', resp.job.id);
    console.log('job.status :', resp.job.status);
    console.log('uploadUrl  :', resp.inputs[0]?.uploadUrl?.slice(0, 60) + '...');

    expect(resp.job.id).toBeTruthy();
    expect(resp.inputs[0].slotName).toBe('original');
    expect(resp.inputs[0].uploadUrl).toBeTruthy();

    // Clean up the created job
    await client.deleteMedia(resp.job.id);
  }, TIMEOUT_MS);
});

describe('listMedia()', () => {
  it('returns a paginated list of jobs', async () => {
    const list = await client.listMedia({ page: 1, pageSize: 5 });
    console.log('total items returned:', list.items.length);
    expect(Array.isArray(list.items)).toBe(true);
  }, TIMEOUT_MS);
});

describe('getMedia()', () => {
  it('fetches a job by id after upload', async () => {
    // Create a job to fetch
    const resp = await client.createMedia({
      taskTypeId: '8',
      inputs: [{
        slotName: 'original',
        contentType: 'image/jpeg',
        fileName: 'test.jpg',
        sizeBytes: 100_000,
      }],
    });
    const jobId = resp.job.id;

    const media = await client.getMedia(jobId);
    console.log('id     :', media.id);
    console.log('status :', media.status);
    expect(media.id).toBe(jobId);

    await client.deleteMedia(jobId);
  }, TIMEOUT_MS);
});

describe('deleteMedia()', () => {
  it('deletes a job without error', async () => {
    const resp = await client.createMedia({
      taskTypeId: '8',
      inputs: [{
        slotName: 'original',
        contentType: 'image/jpeg',
        fileName: 'test.jpg',
        sizeBytes: 100_000,
      }],
    });
    await expect(client.deleteMedia(resp.job.id)).resolves.toBeUndefined();
  }, TIMEOUT_MS);
});
