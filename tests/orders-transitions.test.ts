import { describe, it, expect } from 'vite-plus/test';
import {
  ALLOWED_TRANSITIONS,
  validateOrderTransition,
  allowedNextStatuses,
} from '@/domain/orders';
import type { OrderStatus } from '@/domain/orders';

describe('ALLOWED_TRANSITIONS', () => {
  it('covers every status as a key (so allowedNextStatuses never returns undefined)', () => {
    const all: OrderStatus[] = ['draft', 'submitted', 'quoted', 'accepted', 'cancelled'];
    for (const s of all) {
      expect(ALLOWED_TRANSITIONS[s]).toBeDefined();
    }
  });

  it('treats cancelled as terminal', () => {
    expect(ALLOWED_TRANSITIONS.cancelled).toEqual([]);
  });

  it('treats accepted as terminal except for cancellation', () => {
    expect(ALLOWED_TRANSITIONS.accepted).toEqual(['cancelled']);
  });
});

describe('allowedNextStatuses', () => {
  it('returns the configured set', () => {
    expect(allowedNextStatuses('submitted').sort()).toEqual(['cancelled', 'quoted'].sort());
  });
});

describe('validateOrderTransition', () => {
  it('accepts an allowed transition', () => {
    const errors = validateOrderTransition('submitted', 'quoted');
    expect(errors).toEqual([]);
  });

  it('rejects a disallowed transition with a stable code', () => {
    const errors = validateOrderTransition('cancelled', 'quoted');
    expect(errors).toEqual([{ code: 'invalid_transition', from: 'cancelled', to: 'quoted' }]);
  });

  it('rejects a no-op transition', () => {
    const errors = validateOrderTransition('submitted', 'submitted');
    expect(errors).toEqual([{ code: 'noop_transition', from: 'submitted', to: 'submitted' }]);
  });

  it('rejects an unknown target status', () => {
    // @ts-expect-error — runtime call from API with bad input
    const errors = validateOrderTransition('submitted', 'completed');
    expect(errors).toEqual([{ code: 'unknown_status', to: 'completed' }]);
  });

  it('allows draft → submitted (reserved future path)', () => {
    expect(validateOrderTransition('draft', 'submitted')).toEqual([]);
  });

  it('allows submitted → cancelled', () => {
    expect(validateOrderTransition('submitted', 'cancelled')).toEqual([]);
  });

  it('allows quoted → accepted', () => {
    expect(validateOrderTransition('quoted', 'accepted')).toEqual([]);
  });

  it('allows accepted → cancelled', () => {
    expect(validateOrderTransition('accepted', 'cancelled')).toEqual([]);
  });
});
