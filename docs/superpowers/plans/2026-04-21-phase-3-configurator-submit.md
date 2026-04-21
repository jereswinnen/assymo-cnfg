# Phase 3 — Configurator Submit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the configurator-side submit flow: an "In winkelmandje" CTA in the sidebar that opens a modal, captures contact details, persists the current scene via `POST /api/configs`, submits the order via the already-shipped `POST /api/shop/orders`, and shows a confirmation screen with the order ID and the "we reach out within 1 werkdag" copy.

**Architecture:** All API plumbing already exists — Phase 3 only adds the client surface. A small pure domain module (`src/domain/orders/contactForm.ts`) owns the zod contact schema + the public-error-code → i18n-key mapper so both can be unit-tested without React. A client hook (`useSubmitOrder`) encapsulates the two-step POST chain (configs → shop/orders). A shadcn Dialog + Form component renders the two in-dialog states (form / confirmation). The CTA lives in the existing `SidebarFooter` inside `ObjectsTab.tsx`.

**Tech Stack:** Next 16 (App Router) + React 19, Zustand (`useConfigStore`), shadcn `Dialog` + `Form` + `Input` + `Textarea` + `Button`, react-hook-form + zod + `@hookform/resolvers/zod` (already in deps), Vitest (`vite-plus/test`), Tailwind v4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-04-17-platform-architecture-design.md` — Phase 3 section.

**Reference (read-only):** `/Users/jeremy/Projects/assymo/assymo-frontend/src/components/forms/ContactForm.tsx` — copy the visual field layout + field order (name, email, phone, message), NOT the submit logic (we don't use Turnstile here, we POST to our own API).

---

## File map

Files this plan creates or modifies (grouped by responsibility):

**Domain (pure, no framework imports)**
- Create `src/domain/orders/contactForm.ts` — zod schema `contactFormSchema` + `ContactFormValues` type + `mapShopOrdersErrorCode(code, details?)` returning `{ i18nKey, fieldErrors? }`.
- Modify `src/domain/orders/index.ts` — re-export from `./contactForm`.
- Create `tests/orders-contactForm.test.ts` — schema accept/reject matrix + error-code mapper table.

**Client hook (browser-coupled)**
- Create `src/components/ui/useSubmitOrder.ts` — `useSubmitOrder()` hook that reads the config store, calls `encodeState`, POSTs `/api/configs`, POSTs `/api/shop/orders`, and exposes `{ state, submit, reset }` where `state` is a discriminated union.
- Create `tests/useSubmitOrder.test.ts` — pure tests against the hook's internal `submitOrder` helper (extracted so it's testable without React). Mocks `fetch`.

**UI components**
- Create `src/components/ui/OrderSubmitDialog.tsx` — shadcn `Dialog` + react-hook-form `Form`. Two internal views driven by hook state: form view (`idle` / `submitting` / `error`) and confirmation view (`success`). Uses `t()` exclusively.
- Modify `src/components/ui/ObjectsTab.tsx` — inject `<OrderSubmitDialog />` trigger into `SidebarFooter`, next to `<ConfigCodeDialog />`. Disabled when `buildings.length === 0`.

**i18n**
- Modify `src/lib/i18n.ts` — add `configurator.submit.*` block (CTA, dialog copy, field labels + placeholders, helper text, all public error codes mapped to Dutch copy, confirmation screen copy including "binnen 1 werkdag").

**Docs**
- Modify `CLAUDE.md` — add a "Configurator submit flow" subsection under "Routes" describing the `POST /api/configs` → `POST /api/shop/orders` chain and the in-dialog confirmation.
- Modify `docs/superpowers/specs/2026-04-17-platform-architecture-design.md` — tick `[x] Phase 3 — Configurator submit` in the Progress section (final task, after merge).

---

## Wave 1 — i18n keys

Add every string the modal, CTA, and confirmation screen will render. Doing this first means later waves can reference keys that already resolve (the `t()` helper returns the key verbatim when missing, so the UI won't explode mid-wave; but having them present from the start keeps `pnpm test` + `pnpm build` green at every commit).

### Task 1: Add the `configurator.submit.*` block

**Files:**
- Modify: `src/lib/i18n.ts`

- [ ] **Step 1: Insert the new block after the `email.orderConfirmation.*` block and before the closing `};` of `nl`**

Open `src/lib/i18n.ts` and find the line `'email.orderConfirmation.footer':` (around line 330). After the trailing string and comma on the `email.orderConfirmation.footer` line, insert a blank line, then the following block **before** the `};` that closes the `nl` object (around line 332):

```ts
  // Configurator — "in winkelmandje" submit flow
  'configurator.submit.cta': 'In winkelmandje',
  'configurator.submit.cta.disabled': 'Voeg eerst een object toe',
  'configurator.submit.dialog.title': 'Bestelling plaatsen',
  'configurator.submit.dialog.description':
    'Laat je gegevens achter; wij sturen je binnen één werkdag een offerte op maat.',
  'configurator.submit.field.name.label': 'Naam',
  'configurator.submit.field.name.placeholder': 'Voor- en achternaam',
  'configurator.submit.field.email.label': 'E-mail',
  'configurator.submit.field.email.placeholder': 'naam@voorbeeld.be',
  'configurator.submit.field.phone.label': 'Telefoon',
  'configurator.submit.field.phone.placeholder': '+32 …',
  'configurator.submit.field.phone.optional': '(optioneel)',
  'configurator.submit.field.notes.label': 'Opmerking',
  'configurator.submit.field.notes.placeholder':
    'Extra wensen, bereikbaarheid, …',
  'configurator.submit.field.notes.optional': '(optioneel)',
  'configurator.submit.cancel': 'Annuleren',
  'configurator.submit.submit': 'Verstuur aanvraag',
  'configurator.submit.submitting': 'Bezig met verzenden…',
  // Client-side validation messages (zod → field error)
  'configurator.submit.validation.name.required': 'Vul je naam in.',
  'configurator.submit.validation.email.required': 'Vul je e-mailadres in.',
  'configurator.submit.validation.email.format': 'Ongeldig e-mailadres.',
  'configurator.submit.validation.notes.tooLong':
    'Houd het kort (max. 1000 tekens).',
  // Server error codes from POST /api/shop/orders and POST /api/configs
  'configurator.submit.error.validation_failed':
    'Controleer de ingevulde gegevens.',
  'configurator.submit.error.config_not_found':
    'We konden je configuratie niet terugvinden. Probeer opnieuw.',
  'configurator.submit.error.config_invalid':
    'De configuratie bevat een fout. Pas je ontwerp aan en probeer opnieuw.',
  'configurator.submit.error.email_in_use_by_business':
    'Dit e-mailadres hoort bij een zakelijk account. Gebruik een ander adres of log in.',
  'configurator.submit.error.unknown_tenant':
    'We kunnen je winkel niet identificeren. Vernieuw de pagina en probeer opnieuw.',
  'configurator.submit.error.invalid_code':
    'De opgeslagen configuratie is ongeldig. Vernieuw de pagina en probeer opnieuw.',
  'configurator.submit.error.network':
    'Netwerkfout. Controleer je verbinding en probeer opnieuw.',
  'configurator.submit.error.unknown':
    'Er ging iets mis. Probeer het later opnieuw.',
  // Confirmation screen
  'configurator.submit.success.title': 'Bedankt voor je aanvraag!',
  'configurator.submit.success.lead':
    'We nemen binnen één werkdag contact met je op met een offerte op maat.',
  'configurator.submit.success.orderIdLabel': 'Referentie',
  'configurator.submit.success.totalLabel': 'Geschatte totaal',
  'configurator.submit.success.emailHint':
    'We hebben een bevestiging gestuurd naar {email}. Daarin vind je een link om je account aan te maken en de status te volgen.',
  'configurator.submit.success.emailFallback':
    'De bevestigingsmail kon niet worden verzonden. Geen zorgen — we hebben je aanvraag ontvangen en nemen snel contact op.',
  'configurator.submit.success.close': 'Sluiten',
```

Keep the trailing comma on the last entry so new keys can be appended later without risk.

- [ ] **Step 2: Sanity-check the block**

Run: `pnpm exec tsc --noEmit`

Expected: clean. (`i18n.ts`'s `nl` is a plain object so TS won't narrow keys — no type errors expected from this step.)

- [ ] **Step 3: Add a smoke test**

Append to `tests/i18n.test.ts` before the closing of `describe('t()', () => { ... })`:

```ts
  it('exposes configurator.submit.* keys used by the submit modal', () => {
    expect(t('configurator.submit.cta')).toBe('In winkelmandje');
    expect(t('configurator.submit.dialog.title')).toBe('Bestelling plaatsen');
    expect(
      t('configurator.submit.success.emailHint', { email: 'a@b.c' }),
    ).toContain('a@b.c');
  });
```

Run: `pnpm test -- tests/i18n.test.ts`

Expected: the new case plus the four existing ones all pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n.ts tests/i18n.test.ts
git commit -m "feat(i18n): add configurator.submit.* keys for Phase 3"
```

---

## Wave 2 — Form schema + error-code mapper (pure domain)

Pure TypeScript in `src/domain/orders/`. No React, no fetch. TDD.

### Task 2: Write the contact-form schema + mapper tests

**Files:**
- Create: `tests/orders-contactForm.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/orders-contactForm.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import {
  contactFormSchema,
  mapShopOrdersErrorCode,
  type ContactFormValues,
} from '@/domain/orders/contactForm';

describe('contactFormSchema', () => {
  it('accepts a fully populated payload', () => {
    const input: ContactFormValues = {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '+32 1234',
      notes: 'Graag in de voormiddag.',
    };
    const parsed = contactFormSchema.parse(input);
    expect(parsed).toEqual(input);
  });

  it('accepts a minimal payload (phone + notes omitted)', () => {
    const parsed = contactFormSchema.parse({
      name: 'Ada',
      email: 'ada@example.com',
    });
    expect(parsed.phone).toBeUndefined();
    expect(parsed.notes).toBeUndefined();
  });

  it('trims whitespace from all string fields', () => {
    const parsed = contactFormSchema.parse({
      name: '  Ada  ',
      email: '  ada@example.com  ',
      phone: '  +32  ',
      notes: '  hi  ',
    });
    expect(parsed.name).toBe('Ada');
    expect(parsed.email).toBe('ada@example.com');
    expect(parsed.phone).toBe('+32');
    expect(parsed.notes).toBe('hi');
  });

  it('lowercases the email', () => {
    const parsed = contactFormSchema.parse({
      name: 'Ada',
      email: 'ADA@Example.COM',
    });
    expect(parsed.email).toBe('ada@example.com');
  });

  it('rejects an empty name with the i18n key', () => {
    const result = contactFormSchema.safeParse({ name: '', email: 'a@b.c' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameIssue = result.error.issues.find((i) => i.path[0] === 'name');
      expect(nameIssue?.message).toBe('configurator.submit.validation.name.required');
    }
  });

  it('rejects a missing email with the i18n key', () => {
    const result = contactFormSchema.safeParse({ name: 'Ada', email: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailIssue = result.error.issues.find((i) => i.path[0] === 'email');
      expect(emailIssue?.message).toBe(
        'configurator.submit.validation.email.required',
      );
    }
  });

  it('rejects a malformed email with the i18n key', () => {
    const result = contactFormSchema.safeParse({ name: 'Ada', email: 'not-an-email' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailIssue = result.error.issues.find((i) => i.path[0] === 'email');
      expect(emailIssue?.message).toBe('configurator.submit.validation.email.format');
    }
  });

  it('rejects notes over 1000 chars with the i18n key', () => {
    const result = contactFormSchema.safeParse({
      name: 'Ada',
      email: 'a@b.c',
      notes: 'x'.repeat(1001),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const notesIssue = result.error.issues.find((i) => i.path[0] === 'notes');
      expect(notesIssue?.message).toBe(
        'configurator.submit.validation.notes.tooLong',
      );
    }
  });

  it('normalises empty optional strings to undefined', () => {
    const parsed = contactFormSchema.parse({
      name: 'Ada',
      email: 'a@b.c',
      phone: '   ',
      notes: '',
    });
    expect(parsed.phone).toBeUndefined();
    expect(parsed.notes).toBeUndefined();
  });
});

describe('mapShopOrdersErrorCode', () => {
  it('maps every documented public error code', () => {
    const cases: Array<{ code: string; i18nKey: string }> = [
      { code: 'validation_failed', i18nKey: 'configurator.submit.error.validation_failed' },
      { code: 'config_not_found', i18nKey: 'configurator.submit.error.config_not_found' },
      { code: 'config_invalid', i18nKey: 'configurator.submit.error.config_invalid' },
      { code: 'email_in_use_by_business', i18nKey: 'configurator.submit.error.email_in_use_by_business' },
      { code: 'unknown_tenant', i18nKey: 'configurator.submit.error.unknown_tenant' },
      { code: 'invalid_code', i18nKey: 'configurator.submit.error.invalid_code' },
    ];
    for (const { code, i18nKey } of cases) {
      expect(mapShopOrdersErrorCode(code).i18nKey).toBe(i18nKey);
    }
  });

  it('maps validation_failed details to per-field error keys', () => {
    const mapped = mapShopOrdersErrorCode('validation_failed', [
      'contact.email',
      'contact.name',
      'code',
    ]);
    expect(mapped.i18nKey).toBe('configurator.submit.error.validation_failed');
    expect(mapped.fieldErrors).toEqual({
      email: 'configurator.submit.validation.email.format',
      name: 'configurator.submit.validation.name.required',
    });
  });

  it('falls back to the unknown key for unrecognised codes', () => {
    expect(mapShopOrdersErrorCode('something_weird').i18nKey).toBe(
      'configurator.submit.error.unknown',
    );
  });

  it('maps the client-synthesised "network" sentinel', () => {
    expect(mapShopOrdersErrorCode('network').i18nKey).toBe(
      'configurator.submit.error.network',
    );
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `pnpm test -- tests/orders-contactForm.test.ts`

Expected: FAIL — `contactForm` module does not exist.

### Task 3: Implement `contactForm.ts`

**Files:**
- Create: `src/domain/orders/contactForm.ts`

- [ ] **Step 1: Write the module**

Create `src/domain/orders/contactForm.ts`:

```ts
import { z } from 'zod';

/** Zod schema for the in-dialog contact form. Error messages are i18n
 *  keys — the UI layer runs them through `t()`. Keeping messages as
 *  keys (not Dutch strings) means the schema stays framework-free and
 *  trivially testable. */
export const contactFormSchema = z.object({
  name: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, {
      message: 'configurator.submit.validation.name.required',
    }),
  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .refine((v) => v.length > 0, {
      message: 'configurator.submit.validation.email.required',
    })
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: 'configurator.submit.validation.email.format',
    }),
  phone: z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      const trimmed = v.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    }),
  notes: z
    .string()
    .max(1000, { message: 'configurator.submit.validation.notes.tooLong' })
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      const trimmed = v.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    }),
});

export type ContactFormValues = z.input<typeof contactFormSchema>;
export type ContactFormValuesParsed = z.output<typeof contactFormSchema>;

/** Mapping from `POST /api/shop/orders` public error codes + the
 *  extra `invalid_code` code `POST /api/configs` can emit + a
 *  client-synthesised `network` sentinel to a user-facing i18n key. */
const ERROR_CODE_KEYS: Record<string, string> = {
  validation_failed: 'configurator.submit.error.validation_failed',
  config_not_found: 'configurator.submit.error.config_not_found',
  config_invalid: 'configurator.submit.error.config_invalid',
  email_in_use_by_business:
    'configurator.submit.error.email_in_use_by_business',
  unknown_tenant: 'configurator.submit.error.unknown_tenant',
  invalid_code: 'configurator.submit.error.invalid_code',
  network: 'configurator.submit.error.network',
};

/** Map a single `details[]` entry from the shop-orders validation
 *  response to a field-level i18n key. Returns null when the entry
 *  isn't mappable to one of our form fields (e.g. `code`, which is
 *  synthesised by the client hook and never user-input). */
function detailToFieldError(
  detail: string,
): { field: 'name' | 'email' | 'phone' | 'notes'; key: string } | null {
  switch (detail) {
    case 'contact.name':
      return { field: 'name', key: 'configurator.submit.validation.name.required' };
    case 'contact.email':
      // The server only emits contact.email when the address is either
      // missing or malformed — surface the format message (the stronger
      // of the two) so users always see something actionable.
      return { field: 'email', key: 'configurator.submit.validation.email.format' };
    case 'contact.phone':
      return { field: 'phone', key: 'configurator.submit.validation.email.format' };
    case 'contact.notes':
      return { field: 'notes', key: 'configurator.submit.validation.notes.tooLong' };
    default:
      return null;
  }
}

export interface MappedShopOrdersError {
  /** Top-level banner copy. */
  i18nKey: string;
  /** Field-level errors (only populated for `validation_failed`). */
  fieldErrors?: Partial<Record<'name' | 'email' | 'phone' | 'notes', string>>;
}

export function mapShopOrdersErrorCode(
  code: string,
  details?: string[],
): MappedShopOrdersError {
  const i18nKey =
    ERROR_CODE_KEYS[code] ?? 'configurator.submit.error.unknown';
  if (code !== 'validation_failed' || !details || details.length === 0) {
    return { i18nKey };
  }
  const fieldErrors: MappedShopOrdersError['fieldErrors'] = {};
  for (const d of details) {
    const mapped = detailToFieldError(d);
    if (mapped) fieldErrors[mapped.field] = mapped.key;
  }
  return Object.keys(fieldErrors).length > 0
    ? { i18nKey, fieldErrors }
    : { i18nKey };
}
```

- [ ] **Step 2: Re-export from the orders barrel**

Open `src/domain/orders/index.ts`. It currently re-exports `./types`, `./transitions`, `./snapshot`. Append:

```ts
export * from './contactForm';
```

- [ ] **Step 3: Run the tests to confirm they pass**

Run: `pnpm test -- tests/orders-contactForm.test.ts`

Expected: all 14 tests pass (9 schema + 4 mapper + 1 network sentinel).

- [ ] **Step 4: Full test sweep**

Run: `pnpm test`

Expected: the full suite stays green — the new tests add ~14 cases to the existing 161+.

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/domain/orders/contactForm.ts src/domain/orders/index.ts tests/orders-contactForm.test.ts
git commit -m "feat(domain/orders): add contact-form schema + shop-orders error-code mapper"
```

---

## Wave 3 — Submit-flow hook

A small client hook wraps the two-step POST chain. The pure `submitOrder` function is extracted so it's testable by mocking `fetch`; the React hook is a thin shell around it.

### Task 4: Write tests for the pure `submitOrder` helper

**Files:**
- Create: `tests/useSubmitOrder.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/useSubmitOrder.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vite-plus/test';
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
```

- [ ] **Step 2: Run to confirm the tests fail**

Run: `pnpm test -- tests/useSubmitOrder.test.ts`

Expected: FAIL — `submitOrder` export does not exist.

### Task 5: Implement the hook + helper

**Files:**
- Create: `src/components/ui/useSubmitOrder.ts`

- [ ] **Step 1: Write the module**

Create `src/components/ui/useSubmitOrder.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to confirm they pass**

Run: `pnpm test -- tests/useSubmitOrder.test.ts`

Expected: all 7 tests pass.

- [ ] **Step 3: Full test sweep**

Run: `pnpm test`

Expected: green.

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/useSubmitOrder.ts tests/useSubmitOrder.test.ts
git commit -m "feat(ui): add useSubmitOrder hook chaining configs + shop/orders POSTs"
```

---

## Wave 4 — Modal component

The dialog holds three logical states all in the same shadcn `Dialog`: form (idle/submitting/error), confirmation (success). No navigation; everything lives in the dialog.

### Task 6: Build `OrderSubmitDialog`

**Files:**
- Create: `src/components/ui/OrderSubmitDialog.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/ui/OrderSubmitDialog.tsx`:

```tsx
'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShoppingBag, CheckCircle2, Loader2 } from 'lucide-react';
import {
  contactFormSchema,
  mapShopOrdersErrorCode,
  type ContactFormValues,
} from '@/domain/orders';
import { useConfigStore } from '@/store/useConfigStore';
import { useSubmitOrder } from './useSubmitOrder';
import { t } from '@/lib/i18n';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export default function OrderSubmitDialog() {
  const [open, setOpen] = useState(false);
  const buildingCount = useConfigStore((s) => s.buildings.length);
  const disabled = buildingCount === 0;

  const { state, submit, reset } = useSubmitOrder();

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: { name: '', email: '', phone: '', notes: '' },
    mode: 'onSubmit',
  });

  const mappedError = useMemo(() => {
    if (state.kind !== 'error') return null;
    return mapShopOrdersErrorCode(state.code, state.details);
  }, [state]);

  // Surface server-side field errors onto the form so they render
  // inline next to the right input.
  useMemo(() => {
    if (!mappedError?.fieldErrors) return;
    for (const [field, key] of Object.entries(mappedError.fieldErrors)) {
      form.setError(field as keyof ContactFormValues, {
        type: 'server',
        message: key,
      });
    }
  }, [mappedError, form]);

  const onSubmit = async (values: ContactFormValues) => {
    // zod has already trimmed/normalised. Coerce optional empty-ish
    // values to undefined for the wire payload.
    const parsed = contactFormSchema.parse(values);
    await submit({
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      notes: parsed.notes,
    });
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      // Reset everything when the user closes the dialog, regardless
      // of which view they were on.
      reset();
      form.reset({ name: '', email: '', phone: '', notes: '' });
    }
  };

  const isSubmitting = state.kind === 'submitting';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={disabled ? t('configurator.submit.cta.disabled') : undefined}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40 disabled:pointer-events-none transition-colors ml-auto"
        >
          <ShoppingBag className="h-3.5 w-3.5" />
          {t('configurator.submit.cta')}
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        {state.kind === 'success' ? (
          <SuccessView
            orderId={state.orderId}
            totalCents={state.totalCents}
            currency={state.currency}
            email={form.getValues('email')}
            emailDispatched={state.emailDispatched}
            onClose={() => handleOpenChange(false)}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('configurator.submit.dialog.title')}</DialogTitle>
              <DialogDescription>
                {t('configurator.submit.dialog.description')}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('configurator.submit.field.name.label')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t(
                            'configurator.submit.field.name.placeholder',
                          )}
                          autoComplete="name"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage translateKey />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('configurator.submit.field.email.label')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder={t(
                            'configurator.submit.field.email.placeholder',
                          )}
                          autoComplete="email"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage translateKey />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('configurator.submit.field.phone.label')}{' '}
                        <span className="text-muted-foreground font-normal">
                          {t('configurator.submit.field.phone.optional')}
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder={t(
                            'configurator.submit.field.phone.placeholder',
                          )}
                          autoComplete="tel"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage translateKey />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('configurator.submit.field.notes.label')}{' '}
                        <span className="text-muted-foreground font-normal">
                          {t('configurator.submit.field.notes.optional')}
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t(
                            'configurator.submit.field.notes.placeholder',
                          )}
                          rows={3}
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage translateKey />
                    </FormItem>
                  )}
                />

                {mappedError && (
                  <p
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {t(mappedError.i18nKey)}
                  </p>
                )}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleOpenChange(false)}
                    disabled={isSubmitting}
                  >
                    {t('configurator.submit.cancel')}
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('configurator.submit.submitting')}
                      </>
                    ) : (
                      t('configurator.submit.submit')
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SuccessView({
  orderId,
  totalCents,
  currency,
  email,
  emailDispatched,
  onClose,
}: {
  orderId: string;
  totalCents: number;
  currency: string;
  email: string;
  emailDispatched: boolean;
  onClose: () => void;
}) {
  const total = formatTotal(totalCents, currency);
  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <DialogTitle>
            {t('configurator.submit.success.title')}
          </DialogTitle>
        </div>
        <DialogDescription>
          {t('configurator.submit.success.lead')}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            {t('configurator.submit.success.orderIdLabel')}
          </span>
          <code className="font-mono text-xs">{orderId}</code>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            {t('configurator.submit.success.totalLabel')}
          </span>
          <span className="font-medium tabular-nums">{total}</span>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {emailDispatched
          ? t('configurator.submit.success.emailHint', { email })
          : t('configurator.submit.success.emailFallback')}
      </p>

      <DialogFooter>
        <Button type="button" onClick={onClose}>
          {t('configurator.submit.success.close')}
        </Button>
      </DialogFooter>
    </>
  );
}

function formatTotal(cents: number, currency: string): string {
  const amount = (cents / 100).toLocaleString('nl-BE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  // Currency is always 'EUR' today; keep the symbol-aware branch for
  // future-proofing against additional ISO codes.
  const symbol = currency === 'EUR' ? '\u20AC' : currency + ' ';
  return `${symbol}${amount}`;
}
```

- [ ] **Step 2: Verify the `<FormMessage translateKey />` prop exists**

Look at `src/components/ui/form.tsx` — confirm `FormMessage` can accept arbitrary props (it's a generic slot). If the shipped `FormMessage` does NOT run its message through `t()` automatically, adjust by replacing every `<FormMessage translateKey />` in the component above with:

```tsx
<FormMessage>
  {form.formState.errors.<FIELD>?.message
    ? t(form.formState.errors.<FIELD>.message as string)
    : null}
</FormMessage>
```

…OR, simpler: change the prop-less version inside each `FormField`'s render to a small local wrapper. Pick whichever matches the existing `FormMessage` API in this repo. The tests in Wave 2 guarantee the schema emits i18n **keys** (not Dutch), so the field must run them through `t()` at render time — just make sure that happens.

Run the following to inspect:

```bash
grep -A 30 "FormMessage" src/components/ui/form.tsx
```

If `FormMessage` already calls `t()` on its children, leave the component as written; otherwise, wrap each message in `t(...)` as shown above.

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`

Expected: clean. If TS complains about `translateKey`, remove that prop and use the explicit wrapper from Step 2.

- [ ] **Step 4: Smoke-test with the dev server**

Run: `pnpm dev`

Open `http://localhost:3000/`. Drag an object onto the canvas so `buildings.length > 0`. Confirm:
- The "In winkelmandje" button is visible in the bottom-right of the sidebar footer. (It won't render until Wave 5 wires it into `ObjectsTab.tsx`, so this step only checks that the component imports cleanly and `pnpm dev` doesn't crash. Actual rendering is verified in Wave 5.)

If the dev server starts without errors, we're good.

Stop the dev server with `Ctrl-C`.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/OrderSubmitDialog.tsx
git commit -m "feat(ui): add OrderSubmitDialog for configurator submit flow"
```

---

## Wave 5 — CTA wiring

The dialog exists; now it needs a trigger the user can actually click.

### Task 7: Wire the CTA into `SidebarFooter`

**Files:**
- Modify: `src/components/ui/ObjectsTab.tsx`

- [ ] **Step 1: Import the new component**

Open `src/components/ui/ObjectsTab.tsx`. Under the existing `import ConfigCodeDialog from './ConfigCodeDialog';` line (around line 9), add:

```ts
import OrderSubmitDialog from './OrderSubmitDialog';
```

- [ ] **Step 2: Inject the CTA into `SidebarFooter`**

Still in `src/components/ui/ObjectsTab.tsx`, locate the `SidebarFooter` body (around lines 132–152). Change the footer so the layout is: reset (left) → share-code (left) → submit (right) → export (right, only in non-3D). Replace the existing `return (…)` of `SidebarFooter` with:

```tsx
  return (
    <div className="shrink-0 border-t border-border p-3 flex items-center gap-2">
      <button
        onClick={resetConfig}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {t('app.reset')}
      </button>
      <ConfigCodeDialog />
      <div className="ml-auto flex items-center gap-2">
        <OrderSubmitDialog />
        {viewMode !== '3d' && (
          <button
            onClick={() =>
              exportFloorPlan(
                buildings,
                connections,
                roof,
                tenant.priceBook,
                defaultHeight,
              )
            }
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            {t('export.button')}
          </button>
        )}
      </div>
    </div>
  );
```

Note the important layout change: the previous footer put `ml-auto` on the export button; now a single `<div className="ml-auto …">` wraps both the submit CTA and the export button so they stay grouped on the right regardless of which one is visible.

The `OrderSubmitDialog` manages its own `disabled` state internally (via `useConfigStore(s => s.buildings.length)`), so no extra props are needed here.

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`

Expected: clean.

- [ ] **Step 4: Full manual smoke test**

Pre-flight: this test requires a live Neon DB with the `assymo` tenant seeded (Phase 1) and the orders table migrated (Phase 2). Verify first:

```bash
pnpm db:migrate
```

Expected: "No migrations to apply" OR the 0005 orders migration runs cleanly.

Then:

```bash
pnpm dev
```

Open `http://localhost:3000/`. Perform the golden path:

1. **Drag an `overkapping` onto the canvas.** The CTA should become enabled (no `disabled` attribute, full opacity).
2. **Click "In winkelmandje".** The dialog opens; focus lands on the name field; the dialog title is "Bestelling plaatsen".
3. **Try submitting the empty form.** You should see field errors under name + email, both in Dutch ("Vul je naam in." / "Vul je e-mailadres in.").
4. **Enter a malformed email.** On submit, the email error should change to "Ongeldig e-mailadres.".
5. **Enter valid data** (Name: "Test", Email: `test+phase3@example.com`, Phone: blank, Notes: blank) and submit. The submit button should show a spinner + "Bezig met verzenden…" and disable itself.
6. **On 201**, the dialog swaps to the success view: green check, order ID, total (non-zero), and the emailHint copy with the masked email. Confirm the magic link shows up in the dev terminal where `pnpm dev` is running (if `RESEND_API_KEY` is unset — expected in dev per `CLAUDE.md`).
7. **Close the dialog**, open it again — the form is empty, ready for another submit.
8. **Error path:** re-submit the same valid data with a known business email (e.g. any email already in `user` with `userType='business'`). Expect the top-of-form error copy: "Dit e-mailadres hoort bij een zakelijk account. Gebruik een ander adres of log in."
9. **Verify the admin side:** navigate to `/admin/orders` as a signed-in business user; the new order is at the top of the list with `status=submitted` and the full contact details on the detail page.

If any of steps 1–9 fail, fix before moving on. Do not proceed to docs if the golden path is broken.

Stop the dev server with `Ctrl-C`.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ObjectsTab.tsx
git commit -m "feat(configurator): wire OrderSubmitDialog CTA into sidebar footer"
```

---

## Wave 6 — Verify, document, ship

### Task 8: Full test + build sweep

**Files:** none (verification only)

- [ ] **Step 1: Tests**

Run: `pnpm test`

Expected: all green, including the new `orders-contactForm.test.ts` (+14 cases) and `useSubmitOrder.test.ts` (+7 cases). Tally should be Phase-2 baseline + 21+ new.

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`

Expected: no new errors.

- [ ] **Step 3: Build**

Run: `pnpm build`

Expected: clean. The `(configurator)/page.tsx` and `ObjectsTab.tsx` routes compile with the new client component.

- [ ] **Step 4: Lint sanity**

Run: `pnpm lint`

Expected: no NET-new errors vs `main`. (Pre-existing warnings are out of scope.)

If any of these fail, fix the failure here — do NOT proceed to docs.

### Task 9: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Extend the `src/app/api/shop/*` block**

In the existing `src/app/api/shop/*` bullet (the one that describes `POST /api/shop/orders`), append after the existing description:

```markdown
    The configurator's "In winkelmandje" dialog (see "Configurator submit flow" below) calls this endpoint as the second leg of a two-POST chain: `POST /api/configs` first, then `POST /api/shop/orders` with the returned code.
```

- [ ] **Step 2: Add a new "Configurator submit flow" subsection**

Directly after the existing "Admin UI patterns" subsection (ends with the "Adding a new admin page" bullet), insert a new level-2 section before the "White-label / multi-tenant" section:

```markdown
## Configurator submit flow

The sidebar's "In winkelmandje" CTA (in `src/components/ui/ObjectsTab.tsx`
→ `SidebarFooter`) opens `OrderSubmitDialog`. The dialog collects
name / email / phone / notes via react-hook-form + a zod schema from
`@/domain/orders/contactForm` (messages are i18n **keys** so the schema
stays framework-free and testable).

On submit, `useSubmitOrder` (in `src/components/ui/useSubmitOrder.ts`)
chains two POSTs:

1. `POST /api/configs` with the current `encodeState()` code — persists
   the scene (idempotent per tenant+code).
2. `POST /api/shop/orders` with `{ code, contact }` — the server
   snapshots the priced quote, auto-creates (or reuses) the `client`
   user, and fires the magic-link email.

On 201, the dialog swaps to a confirmation view showing the order ID,
estimated total, and "we reach out within 1 werkdag" copy. Server
error codes (`validation_failed`, `config_not_found`, `config_invalid`,
`email_in_use_by_business`, `unknown_tenant`, `invalid_code`) plus the
client-synthesised `network` / `unknown` sentinels are mapped to
Dutch banner copy via `mapShopOrdersErrorCode` (also in
`@/domain/orders/contactForm`); `validation_failed` details are
surfaced as inline field errors.

The dialog owns the "disabled until there's at least one building"
rule via `useConfigStore(s => s.buildings.length)`. No cart
persistence — closing the dialog discards the form state.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE.md): document configurator submit flow (Phase 3)"
```

### Task 10: Tick `[x] Phase 3` in the spec

**Files:**
- Modify: `docs/superpowers/specs/2026-04-17-platform-architecture-design.md`

This is the LAST task — tick the box once everything is merged. If the merge happens later, do this step in the same PR so docs and code stay in lockstep.

- [ ] **Step 1: Update the Progress section**

In the `## Progress` block at the bottom of the spec, change:

```markdown
- [ ] Phase 3 — Configurator submit
```

to:

```markdown
- [x] Phase 3 — Configurator submit — [plan](../plans/2026-04-21-phase-3-configurator-submit.md)
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-04-17-platform-architecture-design.md
git commit -m "docs(spec): tick [x] Phase 3 — Configurator submit"
```

### Task 11: Merge

- [ ] **Step 1: Push the branch**

```bash
git push -u origin phase-3-configurator-submit
```

- [ ] **Step 2: Open a PR (or merge locally)**

```bash
gh pr create --title "Phase 3 — Configurator submit" --body "$(cat <<'EOF'
## Summary
- New pure `src/domain/orders/contactForm.ts` — zod schema + shop-orders error-code mapper, fully unit-tested.
- New client hook `useSubmitOrder` chaining `POST /api/configs` → `POST /api/shop/orders` with injectable `fetch` for tests.
- New `OrderSubmitDialog` (shadcn `Dialog` + `Form`) with in-dialog form + confirmation views.
- "In winkelmandje" CTA wired into the configurator sidebar footer, disabled until at least one building is placed.
- Dutch i18n block `configurator.submit.*` covering CTA, dialog copy, all server error codes, validation messages, and success screen.
- `CLAUDE.md` documents the two-POST chain + error-mapping convention.

Closes Phase 3 of `docs/superpowers/specs/2026-04-17-platform-architecture-design.md`.

## Test plan
- [ ] `pnpm test` — green (Phase 2 baseline + new contactForm + useSubmitOrder specs).
- [ ] `pnpm exec tsc --noEmit` — clean.
- [ ] `pnpm build` — clean.
- [ ] Golden path: drag an overkapping → submit dialog → confirmation view with order ID + magic link in dev terminal.
- [ ] Error path: submit with a known business email → top-of-form `email_in_use_by_business` banner in Dutch.
- [ ] Order is visible at `/admin/orders` with `status=submitted` and correct contact details.
EOF
)"
```

Merge once green.

---

## Self-Review Notes (run BEFORE handing off)

- **Spec coverage:** Phase 3 deliverables map 1:1 onto tasks — CTA in sidebar (T7), modal with name/email/phone/note (T6), two-POST submit (T4/T5), confirmation screen (T6 `SuccessView`), all five public error codes (T2/T3 tests + T6 banner), Dutch copy (T1). Out-of-scope items (claim landing, webshop chrome, invoices) are intentionally absent and called out in Task 7 Step 4 as "magic link lands on 404 in dev — expected until Phase 4".
- **Type consistency:** `ContactFormValues` (T3) is the sole type consumed by `OrderSubmitDialog` (T6) and `useSubmitOrder.submit` (T5). `SubmitOrderContact` in T5 has the same shape but without the zod branding (so the hook accepts plain parsed values). `SubmitOrderResult` is used as the return type of both the pure `submitOrder` (T5) and the hook's `submit` (T5); the hook's `state` is a richer `SubmitOrderHookState` that adds `idle` and `submitting`. The public error codes listed in T1 (i18n keys), T2 (mapper tests), T3 (`ERROR_CODE_KEYS`), and T6 (`mappedError` lookup) match exactly — `validation_failed`, `config_not_found`, `config_invalid`, `email_in_use_by_business`, `unknown_tenant`, `invalid_code`, plus client `network` / `unknown`.
- **No placeholders:** every code-bearing step shows complete code. One task note (T6 Step 2) acknowledges the known unknown around `<FormMessage>`'s `translateKey` prop and provides a concrete fallback to wrap the error message in `t()` locally — no "fill in later".
- **Framework boundaries:** `src/domain/orders/contactForm.ts` imports only from `zod` — no React, no Next, no fetch. The client hook + dialog live under `src/components/ui/` where browser coupling is allowed per `CLAUDE.md`.
- **Tests vs runtime:** `submitOrder` (T5) accepts an injectable `fetch` so tests run in Node without DOM; the hook defaults to `globalThis.fetch` in the browser. Tests never touch React, keeping them in line with the repo's `environment: 'node'` vitest config.
