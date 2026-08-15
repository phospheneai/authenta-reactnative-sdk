/**
 * Shared HTTP plumbing for the Authenta platform API.
 *
 * These were class methods on AuthentaClient, so they read `this.baseUrl` and
 * `this.authHeaders`. As standalone functions they take that context as an
 * argument instead — the client passes it in and keeps thin wrappers so every
 * existing `this.request(...)` call site is unchanged.
 */

import {
  AuthentaError,
  AuthenticationError,
  AuthorizationError,
  QuotaExceededError,
  InsufficientCreditsError,
  ValidationError,
  ServerError,
} from '../errors';

import { resolveUri as resolveLocalUri } from '../internal/fileSource';
import type { ResolvedUploadSource } from '../internal/fileSource';

export type { ResolvedUploadSource };

export type HttpMethod = 'GET' | 'POST' | 'DELETE';

/** Per-call context that used to come from `this`. */
export interface RequestContext {
  baseUrl: string;
  headers: Record<string, string>;
}

/** Serializes query params, dropping undefined and null values. */
export function buildQueryString(queryParams: Record<string, any>): string {
  return Object.entries(queryParams)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

/** Issues a JSON request and parses the response, or throws a typed error. */
export async function request<T>(
  { baseUrl, headers }: RequestContext,
  method: HttpMethod,
  path: string,
  body?: unknown,
  queryParams?: Record<string, any>,
): Promise<T> {
  let url = `${baseUrl}${path}`;
  if (queryParams) {
    const qs = buildQueryString(queryParams);
    if (qs) url += `?${qs}`;
  }

  // FormData must go through untouched: JSON.stringify would flatten it to
  // "{}", and the Content-Type has to carry the multipart boundary, which only
  // fetch can generate — so drop ours and let it set the header.
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const { 'Content-Type': _json, ...formHeaders } = headers;

  const response = await fetch(url, {
    method,
    headers: isForm ? formHeaders : headers,
    body: isForm ? (body as any) : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    await throwApiError(response);
  }

  const text = await response.text();
  if (!text.trim()) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ValidationError(
      'Expected JSON but received non-JSON response',
      undefined,
      response.status,
      { body: text.slice(0, 200) },
    );
  }
}

/** Maps an error response onto the matching typed error and throws it. */
export async function throwApiError(response: Response): Promise<never> {
  const status = response.status;
  let data: any;

  try {
    data = await response.json();
  } catch {
    const text = await response.text().catch(() => '');
    if (status >= 500) throw new ServerError(text || 'Server error', undefined, status);
    throw new ValidationError(text || 'Client error', undefined, status);
  }

  const code: string = data?.code ?? 'unknown';
  const message: string = data?.message ?? response.statusText ?? 'Unknown error';

  if (code === 'IAM001') throw new AuthenticationError(message, status, data);
  if (code === 'IAM002') throw new AuthorizationError(message, status, data);
  if (code === 'AA001') throw new QuotaExceededError(message, status, data);
  if (code === 'U007') throw new InsufficientCreditsError(message, status, data);
  if (status >= 500) throw new ServerError(message, code, status, data);
  if (status >= 400) throw new ValidationError(message, code, status, data);
  throw new AuthentaError(message, code, status, data);
}

/** Fetch a local URI once — derives name, type, size, and blob for upload.
 *  In React Native uses XMLHttpRequest (fetch('file://...') fails on Android).
 *  In Node.js (tests) uses fs since XMLHttpRequest is not available. */
export async function resolveUri(uri: string): Promise<ResolvedUploadSource> {
  return resolveLocalUri(uri);
}
