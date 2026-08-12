import { FaceIndexClient } from '../src';

const BASE_URL = 'http://faces.example.test';
const TENANT_ID = '6c60ef62-c848-40e3-9cb4-9472ff7b8b58';
const EMPTY_RESULT = { tenant_id: TENANT_ID, count: 0, results: [] };
const originalFetch = global.fetch;

function response(status: number, body: unknown = EMPTY_RESULT): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('FaceIndexClient search', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('sends a large image intact in a POST JSON body with the 120 second timeout', async () => {
    // Same byte size as the reported 2241091.png regression image.
    const imageBase64 = Buffer.alloc(2_672_962, 0xfb).toString('base64');
    const fetchMock = jest.fn().mockResolvedValue(response(200));
    (global as any).fetch = fetchMock;
    const timeoutSpy = jest.spyOn(global, 'setTimeout');

    const client = new FaceIndexClient({ baseUrl: BASE_URL, tenantId: TENANT_ID });
    await client.search(imageBase64);

    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    const request = fetchMock.mock.calls[0][1];
    const payload = JSON.parse(String(request.body));
    const expected = imageBase64.replace(/\+/g, '-').replace(/\//g, '_');

    expect(request.method).toBe('POST');
    expect(request.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(requestUrl.pathname).toBe('/v1/search');
    expect(requestUrl.searchParams.get('limit')).toBe('50');
    expect(requestUrl.searchParams.has('tenant_id')).toBe(false);
    expect(requestUrl.searchParams.has('image_bytes')).toBe(false);
    expect(payload).toEqual({ tenant_id: TENANT_ID, image_bytes: expected });
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 120_000);
  });

  it('lets searchTimeoutMs override the search budget', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue(response(200));
    const timeoutSpy = jest.spyOn(global, 'setTimeout');
    const client = new FaceIndexClient({
      baseUrl: BASE_URL,
      tenantId: TENANT_ID,
      timeoutMs: 10_000,
      searchTimeoutMs: 90_000,
    });

    await client.search('AQI=');

    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 90_000);
  });

  it('retries 429 and 500 responses like the reference Python client', async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response(429))
      .mockResolvedValueOnce(response(500))
      .mockResolvedValueOnce(response(200));
    (global as any).fetch = fetchMock;
    const client = new FaceIndexClient({ baseUrl: BASE_URL, tenantId: TENANT_ID });

    const pending = client.search('AQI=');
    await jest.advanceTimersByTimeAsync(3_000);

    await expect(pending).resolves.toEqual(EMPTY_RESULT);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('matches Python urlsafe_b64encode output and removes line breaks', async () => {
    const fetchMock = jest.fn().mockResolvedValue(response(200));
    (global as any).fetch = fetchMock;
    const client = new FaceIndexClient({ baseUrl: BASE_URL, tenantId: TENANT_ID });

    await client.search('data:image/png;base64,+/8=\n');

    const request = fetchMock.mock.calls[0][1];
    expect(JSON.parse(String(request.body)).image_bytes).toBe('-_8=');
  });

  it('accepts an unpadded Base64 input but sends Python-style padding', async () => {
    const fetchMock = jest.fn().mockResolvedValue(response(200));
    (global as any).fetch = fetchMock;
    const client = new FaceIndexClient({ baseUrl: BASE_URL, tenantId: TENANT_ID });

    await client.search('AQI');

    const request = fetchMock.mock.calls[0][1];
    expect(JSON.parse(String(request.body)).image_bytes).toBe('AQI=');
  });

  it('rejects malformed Base64 before making a request', async () => {
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    const client = new FaceIndexClient({ baseUrl: BASE_URL, tenantId: TENANT_ID });

    await expect(client.search('not-base64!')).rejects.toMatchObject({
      code: 'invalid_base64',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a proxy POST-body limit as image_too_large', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue(response(413));
    const client = new FaceIndexClient({ baseUrl: BASE_URL, tenantId: TENANT_ID });

    await expect(client.search('AQI=')).rejects.toMatchObject({
      code: 'image_too_large',
      statusCode: 413,
    });
  });
});
