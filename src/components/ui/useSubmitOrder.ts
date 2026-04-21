'use client';

import { useCallback, useState } from 'react';
import { useConfigStore } from '@/store/useConfigStore';
import { encodeState } from '@/domain/config';

export interface SubmitOrderContact {
  name: string;
  email: string;
  phone?: string;
  notes?: string;
}

export interface SubmitOrderInput {
  code: string;
  contact: SubmitOrderContact;
  /** Injectable fetch for tests. Defaults to `globalThis.fetch`. */
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
}

export type SubmitOrderResult =
  | {
      kind: 'success';
      orderId: string;
      totalCents: number;
      currency: string;
      emailDispatched: boolean;
    }
  | {
      kind: 'error';
      /** Server error code OR client-synthesised `network` / `unknown`. */
      code: string;
      details?: string[];
    };

interface ErrorResponseBody {
  error?: string;
  details?: unknown;
}

async function postJson<T>(
  fetchFn: NonNullable<SubmitOrderInput['fetch']>,
  url: string,
  body: unknown,
): Promise<{ status: number; data: T | ErrorResponseBody }> {
  const res = await fetchFn(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data: T | ErrorResponseBody;
  try {
    data = (await res.json()) as T | ErrorResponseBody;
  } catch {
    throw new Error('unparseable_json');
  }
  return { status: res.status, data };
}

/** Pure (non-React) submit helper. Lives in the same file as the hook
 *  so the hook can call it directly, but exported so tests can target
 *  it without setting up React. */
export async function submitOrder(
  input: SubmitOrderInput,
): Promise<SubmitOrderResult> {
  const fetchFn = input.fetch ?? globalThis.fetch;

  // Step 1 — persist the share code (idempotent per tenant, code).
  try {
    const { status, data } = await postJson<{ id: string; code: string }>(
      fetchFn,
      '/api/configs',
      { code: input.code },
    );
    if (status !== 200 && status !== 201) {
      const err = data as ErrorResponseBody;
      return {
        kind: 'error',
        code: typeof err.error === 'string' ? err.error : 'unknown',
      };
    }
  } catch (e) {
    if (e instanceof TypeError) {
      return { kind: 'error', code: 'network' };
    }
    return { kind: 'error', code: 'unknown' };
  }

  // Step 2 — submit the order.
  try {
    const { status, data } = await postJson<{
      id: string;
      status: string;
      totalCents: number;
      currency: string;
      emailDispatched: boolean;
    }>(fetchFn, '/api/shop/orders', {
      code: input.code,
      contact: input.contact,
    });
    if (status === 201) {
      const ok = data as {
        id: string;
        totalCents: number;
        currency: string;
        emailDispatched: boolean;
      };
      return {
        kind: 'success',
        orderId: ok.id,
        totalCents: ok.totalCents,
        currency: ok.currency,
        emailDispatched: ok.emailDispatched,
      };
    }
    const err = data as ErrorResponseBody;
    return {
      kind: 'error',
      code: typeof err.error === 'string' ? err.error : 'unknown',
      details: Array.isArray(err.details)
        ? err.details.filter((d): d is string => typeof d === 'string')
        : undefined,
    };
  } catch (e) {
    if (e instanceof TypeError) {
      return { kind: 'error', code: 'network' };
    }
    return { kind: 'error', code: 'unknown' };
  }
}

export type SubmitOrderHookState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | {
      kind: 'success';
      orderId: string;
      totalCents: number;
      currency: string;
      emailDispatched: boolean;
    }
  | { kind: 'error'; code: string; details?: string[] };

export interface UseSubmitOrderReturn {
  state: SubmitOrderHookState;
  /** Reads the current config store, encodes the state, and chains the
   *  two POSTs. Returns the same result object so callers can react to
   *  success inline (e.g. switch the dialog to the confirmation view)
   *  in the same tick that the component sees the updated state. */
  submit: (contact: SubmitOrderContact) => Promise<SubmitOrderResult>;
  reset: () => void;
}

/** React hook wrapper around `submitOrder`. Reads the current scene
 *  from `useConfigStore` so components don't need to pass it in. */
export function useSubmitOrder(): UseSubmitOrderReturn {
  const [state, setState] = useState<SubmitOrderHookState>({ kind: 'idle' });

  const submit = useCallback(
    async (contact: SubmitOrderContact): Promise<SubmitOrderResult> => {
      setState({ kind: 'submitting' });
      const { buildings, connections, roof, defaultHeight } =
        useConfigStore.getState();
      const code = encodeState(buildings, connections, roof, defaultHeight);
      const result = await submitOrder({ code, contact });
      setState(result);
      return result;
    },
    [],
  );

  const reset = useCallback(() => setState({ kind: 'idle' }), []);

  return { state, submit, reset };
}
