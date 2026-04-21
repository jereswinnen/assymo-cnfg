import { describe, it, expect } from 'vite-plus/test';
import { submitOrder } from '@/components/ui/useSubmitOrder';

type FetchMock = (input: string, init?: RequestInit) => Promise<Response>;

function mockFetch(
  handler: (url: string, init?: RequestInit) => {
    status: number;
    body: unknown;
  },
): FetchMock {
  return async (url, init) => {
    const { status, body } = handler(url, init);
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
}

const CONTACT = {
  name: 'Ada',
  email: 'ada@example.com',
  phone: undefined as string | undefined,
  notes: undefined as string | undefined,
};
const CODE = 'ABCD-1234';

describe('submitOrder', () => {
  it('returns success when both POSTs succeed', async () => {
    const fetch = mockFetch((url) => {
      if (url.endsWith('/api/configs')) {
        return { status: 201, body: { id: 'cfg-1', code: CODE } };
      }
      if (url.endsWith('/api/shop/orders')) {
        return {
          status: 201,
          body: {
            id: 'ord-1',
            status: 'submitted',
            totalCents: 123456,
            currency: 'EUR',
            emailDispatched: true,
          },
        };
      }
      throw new Error(`unexpected url ${url}`);
    });

    const result = await submitOrder({ code: CODE, contact: CONTACT, fetch });
    expect(result).toEqual({
      kind: 'success',
      orderId: 'ord-1',
      totalCents: 123456,
      currency: 'EUR',
      emailDispatched: true,
    });
  });

  it('also accepts 200 from /api/configs (idempotent re-save)', async () => {
    const fetch = mockFetch((url) => {
      if (url.endsWith('/api/configs')) {
        return { status: 200, body: { id: 'cfg-1', code: CODE } };
      }
      return {
        status: 201,
        body: {
          id: 'ord-2',
          status: 'submitted',
          totalCents: 0,
          currency: 'EUR',
          emailDispatched: true,
        },
      };
    });
    const result = await submitOrder({ code: CODE, contact: CONTACT, fetch });
    expect(result.kind).toBe('success');
  });

  it('returns error with invalid_code when /api/configs rejects the code', async () => {
    const fetch = mockFetch((url) => {
      if (url.endsWith('/api/configs')) {
        return { status: 400, body: { error: 'invalid_code' } };
      }
      throw new Error('shop/orders must not be called');
    });
    const result = await submitOrder({ code: CODE, contact: CONTACT, fetch });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.code).toBe('invalid_code');
    }
  });

  it('propagates validation_failed details from /api/shop/orders', async () => {
    const fetch = mockFetch((url) => {
      if (url.endsWith('/api/configs')) {
        return { status: 201, body: { id: 'cfg-1', code: CODE } };
      }
      return {
        status: 422,
        body: {
          error: 'validation_failed',
          details: ['contact.email'],
        },
      };
    });
    const result = await submitOrder({ code: CODE, contact: CONTACT, fetch });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.code).toBe('validation_failed');
      expect(result.details).toEqual(['contact.email']);
    }
  });

  it('returns network error when fetch throws', async () => {
    const fetch: FetchMock = async () => {
      throw new TypeError('fetch failed');
    };
    const result = await submitOrder({ code: CODE, contact: CONTACT, fetch });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.code).toBe('network');
    }
  });

  it('returns unknown error on unparsable JSON response', async () => {
    const fetch: FetchMock = async () =>
      new Response('not json', {
        status: 500,
        headers: { 'content-type': 'text/plain' },
      });
    const result = await submitOrder({ code: CODE, contact: CONTACT, fetch });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.code).toBe('unknown');
    }
  });

  it('sends the expected request bodies', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const fetch: FetchMock = async (url, init) => {
      calls.push({
        url,
        body: init?.body ? JSON.parse(init.body as string) : null,
      });
      if (url.endsWith('/api/configs')) {
        return new Response(
          JSON.stringify({ id: 'cfg-1', code: CODE }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          id: 'ord-1',
          status: 'submitted',
          totalCents: 0,
          currency: 'EUR',
          emailDispatched: true,
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      );
    };

    await submitOrder({
      code: CODE,
      contact: { name: 'Ada', email: 'ada@example.com', phone: '+32', notes: 'Hi' },
      fetch,
    });

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe('/api/configs');
    expect(calls[0].body).toEqual({ code: CODE });
    expect(calls[1].url).toBe('/api/shop/orders');
    expect(calls[1].body).toEqual({
      code: CODE,
      contact: {
        name: 'Ada',
        email: 'ada@example.com',
        phone: '+32',
        notes: 'Hi',
      },
    });
  });
});
