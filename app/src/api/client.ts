import { File } from 'expo-file-system';

import { isFieldResponse, isGiftsResponse, isHealthResponse, isNoteResponse } from './guards';
import type {
  ApiPerson,
  ErrorCode,
  Field,
  FieldResponse,
  GiftsRequest,
  GiftsResponse,
  HealthResponse,
  NoteResponse,
} from './types';

export class ApiError extends Error {
  code: ErrorCode;
  status: number | null;

  constructor(code: ErrorCode, status: number | null, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export type ClientConfig = { baseUrl: string; key: string; fetchFn?: typeof fetch };

export type Client = {
  health(): Promise<HealthResponse>;
  field(audioUri: string, field: Field): Promise<FieldResponse>;
  note(audioUri: string, people: ApiPerson[]): Promise<NoteResponse>;
  gifts(req: GiftsRequest): Promise<GiftsResponse>;
};

const KNOWN_CODES: ErrorCode[] = [
  'unauthorized',
  'bad_request',
  'payload_too_large',
  'no_speech',
  'unreadable_date',
  'upstream_failed',
];

function codeForStatus(status: number): ErrorCode {
  switch (status) {
    case 400:
      return 'bad_request';
    case 401:
      return 'unauthorized';
    case 413:
      return 'payload_too_large';
    case 422:
      return 'no_speech';
    default:
      return 'upstream_failed';
  }
}

function errorBody(body: unknown): { code: ErrorCode; message: string } | null {
  const err = (body as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  if (typeof err?.code !== 'string' || typeof err.message !== 'string') {
    return null;
  }
  if (!KNOWN_CODES.includes(err.code as ErrorCode)) {
    return null;
  }
  return { code: err.code as ErrorCode, message: err.message };
}

function audioForm(audioUri: string): FormData {
  const form = new FormData();
  form.append('audio', new File(audioUri), 'clip.m4a');
  return form;
}

export function createClient(config: ClientConfig): Client {
  const baseUrl = config.baseUrl.trim().replace(/\/+$/, '');
  const fetchFn = config.fetchFn ?? fetch;

  async function request<T>(
    endpoint: string,
    init: RequestInit,
    timeoutMs: number,
    isValid: (value: unknown) => value is T,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetchFn(baseUrl + endpoint, {
        ...init,
        headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${config.key}` },
        signal: controller.signal,
      });
    } catch {
      throw new ApiError('unreachable', null, "can't reach backend");
    } finally {
      clearTimeout(timer);
    }
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const err = errorBody(body);
      throw new ApiError(
        err?.code ?? codeForStatus(res.status),
        res.status,
        err?.message ?? `backend returned ${res.status}`,
      );
    }
    if (!isValid(body)) {
      throw new ApiError('upstream_failed', res.status, 'invalid response');
    }
    return body;
  }

  return {
    health: () => request('/health', { method: 'GET' }, 10_000, isHealthResponse),
    field: (audioUri, field) => {
      const form = audioForm(audioUri);
      form.append('field', field);
      return request('/field', { method: 'POST', body: form }, 30_000, (v): v is FieldResponse =>
        isFieldResponse(v, field),
      );
    },
    note: (audioUri, people) => {
      const form = audioForm(audioUri);
      form.append('people', JSON.stringify(people));
      return request('/note', { method: 'POST', body: form }, 120_000, isNoteResponse);
    },
    gifts: (req) =>
      request(
        '/gifts',
        { method: 'POST', body: JSON.stringify(req), headers: { 'Content-Type': 'application/json' } },
        30_000,
        isGiftsResponse,
      ),
  };
}
