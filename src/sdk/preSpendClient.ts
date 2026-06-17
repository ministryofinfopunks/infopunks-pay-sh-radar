import { z } from 'zod';
import {
  PreSpendCheckRequestSchema,
  PreSpendCheckResponseSchema,
  type PreSpendCheckRequest,
  type PreSpendCheckResponse
} from '../schemas/entities';

const PreSpendCheckEnvelopeSchema = z.object({
  data: PreSpendCheckResponseSchema
});

const ErrorEnvelopeSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  details: z.unknown().optional()
}).passthrough();

export type InfopunksPreSpendClientFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type CreateInfopunksPreSpendClientOptions = {
  baseUrl: string;
  fetch?: InfopunksPreSpendClientFetch;
  headers?: HeadersInit;
};

export type InfopunksPreSpendClient = {
  checkPreSpend(input: PreSpendCheckRequest): Promise<PreSpendCheckResponse>;
};

export class InfopunksPreSpendClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly responseBody?: unknown;

  constructor(input: {
    message: string;
    status: number;
    code: string;
    details?: unknown;
    responseBody?: unknown;
  }) {
    super(input.message);
    this.name = 'InfopunksPreSpendClientError';
    this.status = input.status;
    this.code = input.code;
    this.details = input.details;
    this.responseBody = input.responseBody;
  }
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, '');
}

function joinUrl(baseUrl: string, path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizeBaseUrl(baseUrl)}${normalizedPath}`;
}

async function parseJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new InfopunksPreSpendClientError({
      message: `Infopunks Pre-Spend API returned non-JSON for ${response.url || 'request'}.`,
      status: response.status,
      code: 'invalid_json_response',
      responseBody: text
    });
  }
}

export function createInfopunksPreSpendClient(options: CreateInfopunksPreSpendClientOptions): InfopunksPreSpendClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  if (!baseUrl) throw new Error('createInfopunksPreSpendClient requires a non-empty baseUrl.');

  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new InfopunksPreSpendClientError({
      message: 'createInfopunksPreSpendClient requires a fetch implementation. Provide options.fetch or use a runtime with global fetch.',
      status: 0,
      code: 'fetch_unavailable'
    });
  }

  async function post<TInput, TOutput>(path: string, input: TInput, responseSchema: z.ZodType<TOutput>) {
    const response = await fetchImpl(joinUrl(baseUrl, path), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...options.headers
      },
      body: JSON.stringify(input)
    });

    const json = await parseJson(response);

    if (!response.ok) {
      const parsedError = ErrorEnvelopeSchema.safeParse(json);
      throw new InfopunksPreSpendClientError({
        message: parsedError.success
          ? parsedError.data.message ?? parsedError.data.error
          : `Infopunks Pre-Spend API request failed with status ${response.status}.`,
        status: response.status,
        code: parsedError.success ? parsedError.data.error : 'request_failed',
        details: parsedError.success ? parsedError.data.details : undefined,
        responseBody: json
      });
    }

    const parsed = responseSchema.safeParse(json);
    if (!parsed.success) {
      throw new InfopunksPreSpendClientError({
        message: 'Infopunks Pre-Spend API returned an unexpected response shape.',
        status: response.status,
        code: 'invalid_response_shape',
        details: parsed.error.flatten(),
        responseBody: json
      });
    }

    return parsed.data;
  }

  return {
    async checkPreSpend(input: PreSpendCheckRequest) {
      const payload = PreSpendCheckRequestSchema.parse(input);
      const envelope = await post('/v1/pre-spend/check', payload, PreSpendCheckEnvelopeSchema);
      return envelope.data;
    }
  };
}
