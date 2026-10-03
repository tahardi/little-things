import fs from 'node:fs';
import path from 'node:path';

import { ApiError, createClient } from '@/api/client';

jest.mock('expo-file-system', () => ({
  File: class extends Blob {
    uri: string;
    constructor(uri: string) {
      super(['audio-bytes'], { type: 'audio/m4a' });
      this.uri = uri;
    }
  },
}));

function fixture(file: string): string {
  return fs.readFileSync(path.join(__dirname, '../../../api/testdata', file), 'utf8');
}

function respond(status: number, body: string): jest.Mock {
  return jest.fn().mockResolvedValue(new Response(body, { status }));
}

function client(fetchFn: jest.Mock) {
  return createClient({ baseUrl: 'https://pc.ts.net/', key: 'k', fetchFn: fetchFn as unknown as typeof fetch });
}

function formValue(form: FormData, name: string): unknown {
  if (typeof form.get === 'function') {
    return form.get(name);
  }
  const parts = (form as unknown as { getParts(): { fieldName: string; string?: string; uri?: string }[] }).getParts();
  const part = parts.find((p) => p.fieldName === name);
  return part ? (part.string ?? (part as unknown as Blob)) : null;
}

describe('createClient', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('health - sends the key and returns the response', async () => {
    const fetchFn = respond(200, fixture('health-response.json'));

    const got = await client(fetchFn).health();

    expect(got).toEqual({ status: 'ok' });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://pc.ts.net/health');
    expect(init.headers.Authorization).toBe('Bearer k');
  });

  it('field - sends audio and field as form data', async () => {
    const fetchFn = respond(200, fixture('field-response-phone.json'));

    const got = await client(fetchFn).field('file:///a.m4a', 'phone');

    expect(got).toEqual(JSON.parse(fixture('field-response-phone.json')));
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://pc.ts.net/field');
    expect(init.body).toBeInstanceOf(FormData);
    expect(formValue(init.body, 'field')).toBe('phone');
    expect(formValue(init.body, 'audio')).toBeTruthy();
  });

  it.each([
    ['interests', 'field-response-interests.json'],
    ['birthday', 'field-response-birthday.json'],
  ] as const)('field - parses %s response', async (field, file) => {
    const fetchFn = respond(200, fixture(file));

    const got = await client(fetchFn).field('file:///a.m4a', field);

    expect(got).toEqual(JSON.parse(fixture(file)));
  });

  it('field - rejects a response that does not match the field', async () => {
    const fetchFn = respond(200, fixture('field-response-phone.json'));

    const got = client(fetchFn).field('file:///a.m4a', 'birthday');

    await expect(got).rejects.toMatchObject({ code: 'upstream_failed', message: 'invalid response' });
  });

  it('note - sends audio and people as form data', async () => {
    const people = JSON.parse(fixture('note-people.json'));
    const fetchFn = respond(200, fixture('note-response.json'));

    const got = await client(fetchFn).note('file:///a.m4a', people);

    expect(got).toEqual(JSON.parse(fixture('note-response.json')));
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://pc.ts.net/note');
    expect(formValue(init.body, 'people')).toBe(JSON.stringify(people));
    expect(formValue(init.body, 'audio')).toBeTruthy();
  });

  it('gifts - sends JSON', async () => {
    const req = JSON.parse(fixture('gifts-request.json'));
    const fetchFn = respond(200, fixture('gifts-response.json'));

    const got = await client(fetchFn).gifts(req);

    expect(got).toEqual(JSON.parse(fixture('gifts-response.json')));
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://pc.ts.net/gifts');
    expect(init.body).toBe(JSON.stringify(req));
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it.each([
    [401, fixture('error-unauthorized.json'), 'unauthorized'],
    [422, fixture('error-no-speech.json'), 'no_speech'],
    [422, fixture('error-unreadable-date.json'), 'unreadable_date'],
    [400, '', 'bad_request'],
    [413, '', 'payload_too_large'],
    [502, '', 'upstream_failed'],
    [500, 'oops', 'upstream_failed'],
  ])('maps status %i to %s', async (status, body, code) => {
    const fetchFn = respond(status, body);

    const got = client(fetchFn).health();

    await expect(got).rejects.toBeInstanceOf(ApiError);
    await expect(got).rejects.toMatchObject({ code, status });
  });

  it('maps a network error to unreachable', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new TypeError('Network request failed'));

    const got = client(fetchFn).health();

    await expect(got).rejects.toMatchObject({ code: 'unreachable', status: null, message: "can't reach backend" });
  });

  it.each([
    ['health', 10_000],
    ['field', 30_000],
    ['note', 120_000],
    ['gifts', 30_000],
  ] as const)('%s - times out after %i ms', async (endpoint, timeout) => {
    jest.useFakeTimers();
    const fetchFn = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const c = client(fetchFn);
    const calls = {
      health: () => c.health(),
      field: () => c.field('file:///a.m4a', 'phone'),
      note: () => c.note('file:///a.m4a', []),
      gifts: () => c.gifts(JSON.parse(fixture('gifts-request.json'))),
    };
    let settled = false;

    const got = calls[endpoint]().catch((e: unknown) => {
      settled = true;
      return e;
    });
    await jest.advanceTimersByTimeAsync(timeout - 1);
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);

    expect(await got).toMatchObject({ code: 'unreachable' });
  });

  it('keeps the key out of URLs and form values', async () => {
    const fetchFn = respond(200, fixture('field-response-phone.json'));

    await client(fetchFn).field('file:///a.m4a', 'phone');

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).not.toContain('k=');
    expect(url).not.toMatch(/\/k(\/|$)/);
    expect(formValue(init.body, 'field')).not.toBe('k');
    expect(formValue(init.body, 'audio')).not.toBe('k');
  });
});
