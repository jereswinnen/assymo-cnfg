# Phase 1 — Admin Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working `/admin` surface that consumes the full admin API end-to-end, with the schema and guards in place to support every later phase.

**Architecture:** Two new schema columns (`user.userType`, `tenants.branding`), reworked auth-guards (drop `staff`, add `requireBusiness`/`requireClient`), the missing read/list/host/branding API endpoints, and a Next App-Router admin shell with role-aware navigation. All UI strings go through `t()` per the i18n convention.

**Tech Stack:** Next 16 (App Router) + React 19, Drizzle (Neon HTTP), Better Auth, Tailwind v4, shadcn (new-york), react-hook-form + zod (added in this plan), Vitest (`vite-plus/test`).

**Spec:** `docs/superpowers/specs/2026-04-17-platform-architecture-design.md`

---

## File map

Files this plan creates or modifies (grouped by responsibility):

**Schema / migrations**
- Modify `src/db/schema.ts` — add `tenants.branding` column.
- Modify `src/lib/auth.ts` — add `userType` additionalField, drop `staff` from role enum.
- Regenerate `src/db/auth-schema.ts` via Better Auth CLI.
- Create `src/db/migrations/0003_admin_foundation.sql` — `userType` + `branding` columns + Assymo branding backfill.
- Modify `src/db/seed.ts` — populate `branding` for the assymo tenant on seed.

**Domain (pure)**
- Create `src/domain/tenant/branding.ts` — `Branding` type + `DEFAULT_ASSYMO_BRANDING` + `validateBrandingPatch`.
- Modify `src/domain/tenant/index.ts` — re-export branding.
- Create `tests/branding.test.ts` — branding validator tests.

**Auth guards**
- Modify `src/lib/auth-guards.ts` — drop `staff` from `Role`, add `UserType`, `requireBusiness`, `requireClient`.
- Modify `tests/auth-guards.test.ts` — drop staff cases, add new guard cases.

**API**
- Modify `src/app/api/admin/users/route.ts` — use `requireBusiness`, drop `staff` role, add `GET` listing.
- Modify `src/app/api/admin/tenants/route.ts` — use `requireBusiness`, add `GET` listing.
- Create `src/app/api/admin/tenants/[id]/route.ts` — `GET` single tenant.
- Modify `src/app/api/admin/tenants/[id]/price-book/route.ts` — use `requireBusiness`.
- Create `src/app/api/admin/tenants/[id]/hosts/route.ts` — `GET`, `POST`.
- Create `src/app/api/admin/tenants/[id]/hosts/[hostname]/route.ts` — `DELETE`.
- Create `src/app/api/admin/tenants/[id]/branding/route.ts` — `PATCH`.

**UI primitives**
- Run shadcn add: `button input label form dialog card table dropdown-menu sonner badge`.
- Add deps: `react-hook-form`, `zod`, `@hookform/resolvers`, `sonner`.

**Admin shell + pages** — `(authed)` route group separates the session-guarded shell from `/admin/sign-in` so the guard doesn't redirect-loop the sign-in page.
- Create `src/app/admin/(authed)/layout.tsx` — session guard + shell wrapper (URL stays `/admin/...`).
- Create `src/app/admin/(authed)/page.tsx` — dashboard at `/admin`.
- Create `src/app/admin/(authed)/tenants/page.tsx` — list + create dialog (super_admin only).
- Create `src/app/admin/(authed)/tenants/[id]/page.tsx` — sections: details, hosts, branding, price book.
- Create `src/app/admin/(authed)/users/page.tsx` — list + invite dialog.
- Create `src/app/admin/sign-in/layout.tsx` — minimal, sits OUTSIDE `(authed)` so no guard.
- Create `src/app/admin/sign-in/page.tsx` — magic-link form.
- Create `src/components/admin/Sidebar.tsx` — role-aware nav.
- Create `src/components/admin/Header.tsx` — session display + sign-out.
- Create `src/components/admin/TenantsTable.tsx`, `CreateTenantDialog.tsx`.
- Create `src/components/admin/HostsSection.tsx`, `BrandingSection.tsx`, `PriceBookSection.tsx`, `TenantDetailsSection.tsx`.
- Create `src/components/admin/UsersTable.tsx`, `InviteUserDialog.tsx`.

**i18n**
- Modify `src/lib/i18n.ts` — add `admin.*` key block.

**Docs**
- Modify `CLAUDE.md` — drop `staff` references, add `userType`, document new endpoints.
- Modify `ROADMAP.md` — replace stale Phase 1 with link to spec/plan; mark Phase 1 in progress.

---

## Wave 1 — DB foundation

Schema and auth setup must land first because everything else depends on it.

### Task 1: Add `userType` to auth + drop `staff` from role enum

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Update `additionalFields`**

Replace the `additionalFields` block in `src/lib/auth.ts:24-42`:

```ts
  user: {
    additionalFields: {
      tenantId: {
        type: 'string',
        required: false,
        input: false,
      },
      role: {
        type: ['super_admin', 'tenant_admin'] as const,
        required: false,
        defaultValue: 'tenant_admin',
        input: false,
      },
      userType: {
        type: ['business', 'client'] as const,
        required: false,
        defaultValue: 'business',
        input: false,
      },
    },
  },
```

Note: the default role becomes `tenant_admin` instead of `staff` (we dropped staff). Existing rows are migrated in Task 3.

- [ ] **Step 2: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat(auth): add userType field + drop staff from role enum"
```

### Task 2: Regenerate Better Auth schema

**Files:**
- Modify: `src/db/auth-schema.ts` (regenerated)

- [ ] **Step 1: Run the generator**

```bash
pnpm exec @better-auth/cli generate --config src/lib/auth.ts --output src/db/auth-schema.ts --y
```

Expected: file rewritten with `userType` column; `role` column type updated.

- [ ] **Step 2: Verify the diff is what we expect**

```bash
git diff src/db/auth-schema.ts
```

Expected: a `user_type` column added, `role` enum type tightened. No other unrelated drift.

- [ ] **Step 3: Commit**

```bash
git add src/db/auth-schema.ts
git commit -m "feat(db): regenerate auth-schema for userType + tightened role enum"
```

### Task 3: Add `branding` column to `tenants` schema

**Files:**
- Create: `src/domain/tenant/branding.ts`
- Modify: `src/domain/tenant/index.ts`
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Create the branding type + defaults**

Create `src/domain/tenant/branding.ts`:

```ts
/** Per-tenant chrome around the configurator. The configurator UX itself
 *  is the product and stays unbranded; only the wrapper varies. */
export interface Branding {
  /** Used in <title>, header wordmark, email "from". */
  displayName: string;
  /** Path or URL to the logo (rendered in header). */
  logoUrl: string;
  /** Hex color, used as `--brand-primary` CSS var on <html>. */
  primaryColor: string;
  /** Hex color, used as `--brand-accent` CSS var on <html>. */
  accentColor: string;
  /** Footer copy block. */
  footer: {
    contactEmail: string;
    address: string;
    vatNumber: string | null;
  };
}

export const DEFAULT_ASSYMO_BRANDING: Branding = {
  displayName: 'Assymo',
  logoUrl: '/logo-assymo.svg',
  primaryColor: '#1f2937',
  accentColor: '#0ea5e9',
  footer: {
    contactEmail: 'info@assymo.be',
    address: 'TBD',
    vatNumber: null,
  },
};
```

- [ ] **Step 2: Re-export from the tenant module**

Add to the bottom of `src/domain/tenant/index.ts`:

```ts
export * from './branding';
```

- [ ] **Step 3: Add the column to the Drizzle schema**

In `src/db/schema.ts`, import `Branding` and add a `branding` column to `tenants` (insert between `priceBook` and `createdAt`):

```ts
import type { Branding } from '@/domain/tenant';
// ...
  priceBook: jsonb('price_book').$type<PriceBook>().notNull(),
  branding: jsonb('branding').$type<Branding>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
```

- [ ] **Step 4: Generate the SQL migration**

```bash
pnpm db:generate
```

Expected: a new file `src/db/migrations/0003_*.sql` is created. Inspect it.

- [ ] **Step 5: Edit the generated migration to include data backfill**

Rename it (if Drizzle gave it a random name) to `0003_admin_foundation.sql` and ensure it contains:

```sql
-- userType column on user (default 'business' so existing rows stay business)
ALTER TABLE "user" ADD COLUMN "user_type" text DEFAULT 'business' NOT NULL;
--> statement-breakpoint
-- branding column on tenants — nullable in this migration so we can backfill,
-- then set NOT NULL at the end.
ALTER TABLE "tenants" ADD COLUMN "branding" jsonb;
--> statement-breakpoint
UPDATE "tenants" SET "branding" = '{
  "displayName": "Assymo",
  "logoUrl": "/logo-assymo.svg",
  "primaryColor": "#1f2937",
  "accentColor": "#0ea5e9",
  "footer": { "contactEmail": "info@assymo.be", "address": "TBD", "vatNumber": null }
}'::jsonb WHERE "branding" IS NULL;
--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "branding" SET NOT NULL;
--> statement-breakpoint
-- Existing 'staff' rows get re-mapped to 'tenant_admin' (we no longer have staff).
UPDATE "user" SET "role" = 'tenant_admin' WHERE "role" = 'staff';
```

If Drizzle's autogenerated migration shape doesn't exactly match, keep its column-add statements but add the UPDATE/SET NOT NULL/role-remap blocks shown above.

- [ ] **Step 6: Apply the migration**

```bash
pnpm db:migrate
```

Expected: migration applies cleanly. If you see a "branding cannot be null" error, the backfill UPDATE didn't run before SET NOT NULL — fix the order in the SQL.

- [ ] **Step 7: Commit**

```bash
git add src/domain/tenant/branding.ts src/domain/tenant/index.ts src/db/schema.ts src/db/migrations/0003_admin_foundation.sql
git commit -m "feat(db): add tenants.branding + user.userType columns

userType discriminates business vs client users (single Better Auth
instance). branding holds the per-tenant chrome (displayName, logo,
colors, footer) consumed by the webshop in Phase 4. Migration
backfills Assymo defaults and re-maps the dropped 'staff' role to
tenant_admin."
```

### Task 4: Update seed to populate branding

**Files:**
- Modify: `src/db/seed.ts`

- [ ] **Step 1: Read the current seed**

Open `src/db/seed.ts` and locate the assymo upsert.

- [ ] **Step 2: Include branding in the upsert payload**

Add `DEFAULT_ASSYMO_BRANDING` as the `branding` field in both the insert and the update branch. Import:

```ts
import { DEFAULT_ASSYMO_BRANDING } from '@/domain/tenant';
```

Add `branding: DEFAULT_ASSYMO_BRANDING` to whatever object is passed into `db.insert(tenants).values(...)` and `db.update(tenants).set(...)`.

- [ ] **Step 3: Run the seed**

```bash
pnpm db:seed
```

Expected: idempotent — runs without error and the assymo row's `branding` is populated.

- [ ] **Step 4: Commit**

```bash
git add src/db/seed.ts
git commit -m "feat(db): include branding in assymo seed"
```

---

## Wave 2 — Auth guards

Pure functions, full TDD.

### Task 5: Add `UserType`, `requireBusiness`, `requireClient`; drop `staff`

**Files:**
- Modify: `src/lib/auth-guards.ts`
- Modify: `tests/auth-guards.test.ts`

- [ ] **Step 1: Update existing tests for the new role set**

Replace the body of `tests/auth-guards.test.ts` with:

```ts
import { describe, it, expect } from 'vite-plus/test';
import {
  AuthError,
  requireRole,
  requireTenantScope,
  requireBusiness,
  requireClient,
  type UserType,
} from '@/lib/auth-guards';
import type { Session } from '@/lib/auth';

function mkSession(
  role: string | null,
  tenantId: string | null,
  userType: UserType | null = 'business',
): Session {
  return {
    session: {} as Session['session'],
    user: { role, tenantId, userType } as Session['user'],
  };
}

describe('requireRole', () => {
  it('passes when the role is allowed', () => {
    expect(() =>
      requireRole(mkSession('super_admin', null), ['super_admin']),
    ).not.toThrow();
  });

  it('throws forbidden_role when the role is not in the list', () => {
    try {
      requireRole(mkSession('tenant_admin', 'assymo'), ['super_admin']);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).code).toBe('forbidden_role');
      expect((err as AuthError).status).toBe(403);
    }
  });

  it('throws when the user has no role at all', () => {
    expect(() =>
      requireRole(mkSession(null, 'assymo'), ['tenant_admin']),
    ).toThrow(AuthError);
  });
});

describe('requireTenantScope', () => {
  it('super_admin can touch any tenant', () => {
    const s = mkSession('super_admin', null);
    expect(() => requireTenantScope(s, 'assymo')).not.toThrow();
    expect(() => requireTenantScope(s, 'other')).not.toThrow();
  });

  it('tenant_admin can touch its own tenant only', () => {
    const s = mkSession('tenant_admin', 'assymo');
    expect(() => requireTenantScope(s, 'assymo')).not.toThrow();
    expect(() => requireTenantScope(s, 'other')).toThrow(AuthError);
  });

  it('throws forbidden_tenant when mismatched', () => {
    try {
      requireTenantScope(mkSession('tenant_admin', 'assymo'), 'other');
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as AuthError).code).toBe('forbidden_tenant');
    }
  });
});

describe('requireBusiness', () => {
  it('passes for a business user with an allowed role', () => {
    expect(() =>
      requireBusiness(mkSession('tenant_admin', 'assymo', 'business'), ['tenant_admin']),
    ).not.toThrow();
  });

  it('throws forbidden_user_type when the user is a client', () => {
    try {
      requireBusiness(mkSession('tenant_admin', 'assymo', 'client'), ['tenant_admin']);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as AuthError).code).toBe('forbidden_user_type');
    }
  });

  it('throws forbidden_role when the role is not allowed', () => {
    try {
      requireBusiness(mkSession('tenant_admin', 'assymo', 'business'), ['super_admin']);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as AuthError).code).toBe('forbidden_role');
    }
  });
});

describe('requireClient', () => {
  it('passes for a client user', () => {
    expect(() =>
      requireClient(mkSession(null, 'assymo', 'client')),
    ).not.toThrow();
  });

  it('throws forbidden_user_type for a business user', () => {
    try {
      requireClient(mkSession('tenant_admin', 'assymo', 'business'));
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as AuthError).code).toBe('forbidden_user_type');
    }
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test tests/auth-guards.test.ts
```

Expected: import errors / failed assertions for the new exports.

- [ ] **Step 3: Update `auth-guards.ts`**

Replace the contents of `src/lib/auth-guards.ts` with:

```ts
import { NextResponse } from 'next/server';
import type { Session } from './auth';

export type Role = 'super_admin' | 'tenant_admin';
export type UserType = 'business' | 'client';

export const ALL_ROLES = ['super_admin', 'tenant_admin'] as const satisfies readonly Role[];
export const ALL_USER_TYPES = ['business', 'client'] as const satisfies readonly UserType[];

export type AuthErrorCode =
  | 'unauthenticated'
  | 'forbidden_role'
  | 'forbidden_tenant'
  | 'forbidden_user_type';

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    public readonly status: number,
  ) {
    super(code);
  }
}

/** Require the session's user role to be one of the given values. */
export function requireRole(session: Session, roles: readonly Role[]): void {
  const role = session.user.role as Role | null | undefined;
  if (!role || !roles.includes(role)) {
    throw new AuthError('forbidden_role', 403);
  }
}

/** Tenant-scope check. super_admin bypasses; everyone else must match
 *  their own tenantId. */
export function requireTenantScope(session: Session, tenantId: string): void {
  const role = session.user.role as Role | null | undefined;
  if (role === 'super_admin') return;
  if (session.user.tenantId !== tenantId) {
    throw new AuthError('forbidden_tenant', 403);
  }
}

/** Require a business userType + an allowed business role. Used by
 *  every /api/admin/* endpoint. */
export function requireBusiness(session: Session, roles: readonly Role[]): void {
  const userType = session.user.userType as UserType | null | undefined;
  if (userType !== 'business') {
    throw new AuthError('forbidden_user_type', 403);
  }
  requireRole(session, roles);
}

/** Require a client userType. Used by every /api/shop/* endpoint
 *  (added in Phase 2 — guard ships here so the API and UI can
 *  rely on it consistently). */
export function requireClient(session: Session): void {
  const userType = session.user.userType as UserType | null | undefined;
  if (userType !== 'client') {
    throw new AuthError('forbidden_user_type', 403);
  }
}

/** Convert any thrown error into a JSON response. */
export function toAuthErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.code }, { status: err.status });
  }
  throw err;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test tests/auth-guards.test.ts
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-guards.ts tests/auth-guards.test.ts
git commit -m "feat(auth-guards): add UserType + requireBusiness/requireClient, drop staff role"
```

---

## Wave 3 — Refactor existing endpoints

Three existing endpoints assume `staff` exists or use `requireRole` directly. Switch them to `requireBusiness`.

### Task 6: Update existing admin endpoints to use `requireBusiness`

**Files:**
- Modify: `src/app/api/admin/users/route.ts`
- Modify: `src/app/api/admin/tenants/route.ts`
- Modify: `src/app/api/admin/tenants/[id]/price-book/route.ts`

- [ ] **Step 1: Update `users/route.ts`**

In `src/app/api/admin/users/route.ts`:

- Change `import { AuthError, requireRole, type Role }` → `import { AuthError, requireBusiness, type Role }`.
- Change `const CREATABLE_ROLES: readonly Role[] = ['super_admin', 'tenant_admin', 'staff'];` → `const CREATABLE_ROLES: readonly Role[] = ['super_admin', 'tenant_admin'];`.
- Change `requireRole(session, ['super_admin', 'tenant_admin']);` → `requireBusiness(session, ['super_admin', 'tenant_admin']);`.
- In the `db.insert(user).values({ ... })` call, add `userType: 'business' as const,`.

- [ ] **Step 2: Update `tenants/route.ts`**

Open it, change any `requireRole(session, ['super_admin'])` → `requireBusiness(session, ['super_admin'])`, and update the import accordingly.

- [ ] **Step 3: Update `price-book/route.ts`**

Replace `requireRole(session, ['super_admin', 'tenant_admin'])` with `requireBusiness(session, ['super_admin', 'tenant_admin'])` and update the import.

- [ ] **Step 4: Run tests + typecheck**

```bash
pnpm test && pnpm exec tsc --noEmit
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/
git commit -m "refactor(admin-api): use requireBusiness; drop staff from creatable roles; tag created users as business"
```

---

## Wave 4 — Branding domain validator

Pure function, full TDD. Used by the branding PATCH endpoint (Wave 5) and the admin UI form.

### Task 7: `validateBrandingPatch`

**Files:**
- Create: `tests/branding.test.ts`
- Modify: `src/domain/tenant/branding.ts`

- [ ] **Step 1: Write the test**

Create `tests/branding.test.ts`:

```ts
import { describe, it, expect } from 'vite-plus/test';
import { validateBrandingPatch } from '@/domain/tenant';

describe('validateBrandingPatch', () => {
  it('accepts a complete valid patch', () => {
    const { branding, errors } = validateBrandingPatch({
      displayName: 'Partner BV',
      logoUrl: '/logos/partner.svg',
      primaryColor: '#ff0000',
      accentColor: '#00ff00',
      footer: { contactEmail: 'hi@partner.be', address: 'X', vatNumber: 'BE0123' },
    });
    expect(errors).toEqual([]);
    expect(branding.displayName).toBe('Partner BV');
  });

  it('accepts a partial patch (only displayName)', () => {
    const { branding, errors } = validateBrandingPatch({ displayName: 'Just Name' });
    expect(errors).toEqual([]);
    expect(branding).toEqual({ displayName: 'Just Name' });
  });

  it('rejects invalid hex colors', () => {
    const { errors } = validateBrandingPatch({ primaryColor: 'red' });
    expect(errors).toContain('primaryColor');
  });

  it('rejects empty displayName', () => {
    const { errors } = validateBrandingPatch({ displayName: '' });
    expect(errors).toContain('displayName');
  });

  it('rejects non-object input', () => {
    const { errors } = validateBrandingPatch(null);
    expect(errors).toContain('body');
  });

  it('validates nested footer fields independently', () => {
    const { errors } = validateBrandingPatch({
      footer: { contactEmail: 'not-an-email', address: 'X', vatNumber: null },
    });
    expect(errors).toContain('footer.contactEmail');
  });
});
```

- [ ] **Step 2: Run, see them fail**

```bash
pnpm test tests/branding.test.ts
```

Expected: import error for `validateBrandingPatch`.

- [ ] **Step 3: Add the validator**

Append to `src/domain/tenant/branding.ts`:

```ts
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ValidatedBrandingPatch {
  branding: Partial<Branding>;
  errors: string[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Validate a partial branding update. Mirrors the shape of
 *  validatePriceBookPatch — returns the cleaned partial plus a list
 *  of field paths that failed. Empty errors == safe to merge. */
export function validateBrandingPatch(input: unknown): ValidatedBrandingPatch {
  if (!isObject(input)) return { branding: {}, errors: ['body'] };

  const out: Partial<Branding> = {};
  const errors: string[] = [];

  if ('displayName' in input) {
    if (typeof input.displayName === 'string' && input.displayName.length > 0) {
      out.displayName = input.displayName;
    } else errors.push('displayName');
  }
  if ('logoUrl' in input) {
    if (typeof input.logoUrl === 'string' && input.logoUrl.length > 0) {
      out.logoUrl = input.logoUrl;
    } else errors.push('logoUrl');
  }
  for (const k of ['primaryColor', 'accentColor'] as const) {
    if (k in input) {
      if (typeof input[k] === 'string' && HEX_RE.test(input[k] as string)) {
        out[k] = input[k] as string;
      } else errors.push(k);
    }
  }
  if ('footer' in input) {
    if (!isObject(input.footer)) {
      errors.push('footer');
    } else {
      const f = input.footer;
      const footerOut: Partial<Branding['footer']> = {};
      if ('contactEmail' in f) {
        if (typeof f.contactEmail === 'string' && EMAIL_RE.test(f.contactEmail)) {
          footerOut.contactEmail = f.contactEmail;
        } else errors.push('footer.contactEmail');
      }
      if ('address' in f) {
        if (typeof f.address === 'string' && f.address.length > 0) {
          footerOut.address = f.address;
        } else errors.push('footer.address');
      }
      if ('vatNumber' in f) {
        if (f.vatNumber === null || typeof f.vatNumber === 'string') {
          footerOut.vatNumber = f.vatNumber as string | null;
        } else errors.push('footer.vatNumber');
      }
      // Caller must merge with the existing footer; we return only the touched keys.
      out.footer = footerOut as Branding['footer'];
    }
  }

  return { branding: out, errors };
}
```

- [ ] **Step 4: Run tests, confirm green**

```bash
pnpm test tests/branding.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/tenant/branding.ts tests/branding.test.ts
git commit -m "feat(domain/tenant): add validateBrandingPatch + Branding type"
```

---

## Wave 5 — Missing API endpoints

Each endpoint is one task. They follow the existing `withSession` + `requireBusiness` + `requireTenantScope` pattern (see `src/app/api/admin/tenants/[id]/price-book/route.ts` for the canonical shape).

### Task 8: `GET /api/admin/users` (list scoped users)

**Files:**
- Modify: `src/app/api/admin/users/route.ts`

- [ ] **Step 1: Add the GET handler**

Append to `src/app/api/admin/users/route.ts`:

```ts
/** List business users in scope. super_admin sees all rows;
 *  tenant_admin sees only its own tenant. Clients are excluded
 *  (those go through a separate /api/admin/clients endpoint in
 *  Phase 2). */
export const GET = withSession(async (session) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);
  const actorRole = session.user.role as Role;
  const actorTenantId = session.user.tenantId as string | null;

  const baseQuery = db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.userType, 'business'));

  const rows =
    actorRole === 'super_admin'
      ? await baseQuery
      : await db
          .select({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            tenantId: user.tenantId,
            createdAt: user.createdAt,
          })
          .from(user)
          .where(and(eq(user.userType, 'business'), eq(user.tenantId, actorTenantId ?? '__none__')));

  return NextResponse.json({ users: rows });
});
```

Add `and` to the `drizzle-orm` import at the top of the file.

- [ ] **Step 2: Manual smoke test**

```bash
pnpm dev
# In a second shell, sign in as super_admin via the existing flow,
# then:
curl -s http://localhost:3000/api/admin/users \
  -H "Cookie: $(cat /tmp/admin-session-cookie 2>/dev/null || echo)" \
  | jq .
```

Expected: `{ "users": [...] }`. Without a session cookie, expect `{ "error": "unauthenticated" }` 401.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/users/route.ts
git commit -m "feat(admin-api): GET /api/admin/users (list scoped business users)"
```

### Task 9: `GET /api/admin/tenants` + `GET /api/admin/tenants/[id]`

**Files:**
- Modify: `src/app/api/admin/tenants/route.ts`
- Create: `src/app/api/admin/tenants/[id]/route.ts`

- [ ] **Step 1: Add list handler**

Append to `src/app/api/admin/tenants/route.ts`:

```ts
/** List tenants. super_admin only — tenant_admin reads its own tenant
 *  via /api/admin/tenants/[id] (or /api/admin/tenants/current). */
export const GET = withSession(async (session) => {
  requireBusiness(session, ['super_admin']);
  const rows = await db.select().from(tenants);
  return NextResponse.json({ tenants: rows });
});
```

Make sure `db`, `tenants`, `withSession`, `requireBusiness`, `NextResponse` are imported.

- [ ] **Step 2: Create the single-tenant handler**

Create `src/app/api/admin/tenants/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { tenants } from '@/db/schema';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

/** Read a single tenant. super_admin reads any; tenant_admin reads
 *  only its own. */
export const GET = withSession(
  async (session, _req, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;
    requireTenantScope(session, id);

    const [row] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    if (!row) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });
    return NextResponse.json({ tenant: row });
  },
);
```

- [ ] **Step 3: Smoke test**

```bash
curl -s http://localhost:3000/api/admin/tenants -H "Cookie: ..." | jq .
curl -s http://localhost:3000/api/admin/tenants/assymo -H "Cookie: ..." | jq .
```

Expected: lists / single tenant for super_admin; 403 for tenant_admin asking for someone else's id.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/tenants/route.ts src/app/api/admin/tenants/[id]/route.ts
git commit -m "feat(admin-api): GET tenants list + GET tenants/[id]"
```

### Task 10: `tenant_hosts` endpoints (`GET`, `POST`, `DELETE`)

**Files:**
- Create: `src/app/api/admin/tenants/[id]/hosts/route.ts`
- Create: `src/app/api/admin/tenants/[id]/hosts/[hostname]/route.ts`

- [ ] **Step 1: Create the list/create handler**

Create `src/app/api/admin/tenants/[id]/hosts/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { tenantHosts, tenants } from '@/db/schema';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

function normalizeHost(input: string): string {
  return input.trim().toLowerCase();
}

export const GET = withSession(
  async (session, _req, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;
    requireTenantScope(session, id);

    const rows = await db.select().from(tenantHosts).where(eq(tenantHosts.tenantId, id));
    return NextResponse.json({ hosts: rows });
  },
);

interface PostBody { hostname?: unknown }

export const POST = withSession(
  async (session, req, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;
    requireTenantScope(session, id);

    let body: PostBody;
    try { body = await req.json() as PostBody; }
    catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

    if (typeof body.hostname !== 'string' || body.hostname.trim().length === 0) {
      return NextResponse.json(
        { error: 'validation_failed', details: ['hostname'] },
        { status: 422 },
      );
    }
    const hostname = normalizeHost(body.hostname);

    const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, id)).limit(1);
    if (!tenant) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });

    try {
      const [inserted] = await db
        .insert(tenantHosts)
        .values({ hostname, tenantId: id })
        .returning();
      return NextResponse.json({ host: inserted }, { status: 201 });
    } catch {
      return NextResponse.json({ error: 'conflict' }, { status: 409 });
    }
  },
);
```

- [ ] **Step 2: Create the delete handler**

Create `src/app/api/admin/tenants/[id]/hosts/[hostname]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { tenantHosts } from '@/db/schema';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

export const DELETE = withSession(
  async (session, _req, ctx: { params: Promise<{ id: string; hostname: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id, hostname } = await ctx.params;
    requireTenantScope(session, id);

    const decoded = decodeURIComponent(hostname).toLowerCase();
    const result = await db
      .delete(tenantHosts)
      .where(and(eq(tenantHosts.tenantId, id), eq(tenantHosts.hostname, decoded)))
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: 'host_not_found' }, { status: 404 });
    }
    return NextResponse.json({ deleted: result[0] });
  },
);
```

- [ ] **Step 3: Smoke test**

```bash
curl -s -X POST http://localhost:3000/api/admin/tenants/assymo/hosts \
  -H "Content-Type: application/json" -H "Cookie: ..." \
  -d '{"hostname":"localhost:3001"}' | jq .

curl -s http://localhost:3000/api/admin/tenants/assymo/hosts -H "Cookie: ..." | jq .

curl -s -X DELETE http://localhost:3000/api/admin/tenants/assymo/hosts/localhost%3A3001 \
  -H "Cookie: ..." | jq .
```

Expected: 201 / 200 with hosts list / 200 deleted. Posting the same hostname twice → 409.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/tenants/[id]/hosts/
git commit -m "feat(admin-api): tenant_hosts CRUD (GET/POST + DELETE [hostname])"
```

### Task 11: `PATCH /api/admin/tenants/[id]/branding`

**Files:**
- Create: `src/app/api/admin/tenants/[id]/branding/route.ts`

- [ ] **Step 1: Create the handler**

```ts
import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { tenants } from '@/db/schema';
import { validateBrandingPatch, type Branding } from '@/domain/tenant';
import { requireBusiness, requireTenantScope } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

/** PATCH the tenant's branding. Mirrors the price-book PATCH shape:
 *  partial body, deep-merge over the stored jsonb. */
export const PATCH = withSession(
  async (session, req, ctx: { params: Promise<{ id: string }> }) => {
    requireBusiness(session, ['super_admin', 'tenant_admin']);
    const { id } = await ctx.params;
    requireTenantScope(session, id);

    let body: unknown;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

    const { branding, errors } = validateBrandingPatch(body);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'validation_failed', details: errors },
        { status: 422 },
      );
    }
    if (Object.keys(branding).length === 0) {
      return NextResponse.json({ error: 'empty_patch' }, { status: 400 });
    }

    const [current] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    if (!current) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });

    // Deep-merge footer; everything else is scalar.
    const merged: Branding = {
      ...current.branding,
      ...branding,
      footer: {
        ...current.branding.footer,
        ...(branding.footer ?? {}),
      },
    };

    const [updated] = await db
      .update(tenants)
      .set({ branding: merged, updatedAt: sql`now()` })
      .where(eq(tenants.id, id))
      .returning();

    return NextResponse.json({ tenant: updated });
  },
);
```

- [ ] **Step 2: Smoke test**

```bash
curl -s -X PATCH http://localhost:3000/api/admin/tenants/assymo/branding \
  -H "Content-Type: application/json" -H "Cookie: ..." \
  -d '{"primaryColor":"#112233"}' | jq .
```

Expected: `{ "tenant": { ..., "branding": { "primaryColor": "#112233", ... } } }`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/tenants/[id]/branding/
git commit -m "feat(admin-api): PATCH /api/admin/tenants/[id]/branding"
```

---

## Wave 6 — UI primitives + i18n

### Task 12: Install form deps + add shadcn primitives

**Files:**
- Modify: `package.json` (deps)
- Add several files in `src/components/ui/`

- [ ] **Step 1: Install runtime deps**

```bash
pnpm add react-hook-form zod @hookform/resolvers sonner
```

- [ ] **Step 2: Scaffold shadcn primitives**

```bash
pnpm dlx shadcn@latest add button input label form dialog card table dropdown-menu sonner badge
```

When prompted to overwrite existing files (e.g., `label.tsx`), inspect each diff first; accept the new version unless it strips an in-house tweak.

- [ ] **Step 3: Verify build still passes**

```bash
pnpm exec tsc --noEmit && pnpm build
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/ui/
git commit -m "feat(ui): add shadcn primitives + react-hook-form/zod/sonner deps"
```

### Task 13: Add admin i18n keys

**Files:**
- Modify: `src/lib/i18n.ts`

- [ ] **Step 1: Append the admin block**

Add this block before the closing `}` of the `nl` map (mirror existing comment-style):

```ts
  // Admin shell
  'admin.title': 'Beheer',
  'admin.signIn.title': 'Inloggen bij beheer',
  'admin.signIn.email': 'E-mailadres',
  'admin.signIn.submit': 'Stuur inloglink',
  'admin.signIn.sent': 'Check je inbox voor de inloglink.',
  'admin.signIn.error': 'Er ging iets mis. Probeer het opnieuw.',
  'admin.signOut': 'Uitloggen',
  'admin.nav.dashboard': 'Overzicht',
  'admin.nav.tenants': 'Tenants',
  'admin.nav.users': 'Gebruikers',
  'admin.nav.tenant': 'Mijn tenant',
  'admin.dashboard.greeting': 'Welkom, {name}',
  'admin.dashboard.tenant': 'Tenant: {tenant}',
  'admin.dashboard.role': 'Rol: {role}',

  // Admin — tenants
  'admin.tenants.title': 'Tenants',
  'admin.tenants.create': 'Nieuwe tenant',
  'admin.tenants.empty': 'Nog geen tenants.',
  'admin.tenants.col.id': 'ID',
  'admin.tenants.col.displayName': 'Naam',
  'admin.tenants.col.locale': 'Taal',
  'admin.tenants.col.currency': 'Valuta',
  'admin.tenants.create.title': 'Nieuwe tenant aanmaken',
  'admin.tenants.create.id': 'ID (slug)',
  'admin.tenants.create.displayName': 'Weergavenaam',
  'admin.tenants.create.submit': 'Aanmaken',
  'admin.tenants.create.error': 'Aanmaken mislukt: {error}',

  // Admin — single tenant detail
  'admin.tenant.section.details': 'Details',
  'admin.tenant.section.hosts': 'Hosts',
  'admin.tenant.section.branding': 'Branding',
  'admin.tenant.section.priceBook': 'Prijsboek',
  'admin.tenant.hosts.add': 'Host toevoegen',
  'admin.tenant.hosts.placeholder': 'partner.configurator.be',
  'admin.tenant.hosts.empty': 'Nog geen hosts gekoppeld.',
  'admin.tenant.hosts.delete': 'Verwijderen',
  'admin.tenant.branding.displayName': 'Weergavenaam',
  'admin.tenant.branding.logoUrl': 'Logo-URL',
  'admin.tenant.branding.primaryColor': 'Hoofdkleur',
  'admin.tenant.branding.accentColor': 'Accentkleur',
  'admin.tenant.branding.footer.contactEmail': 'Contact e-mail',
  'admin.tenant.branding.footer.address': 'Adres',
  'admin.tenant.branding.footer.vatNumber': 'BTW-nummer',
  'admin.tenant.save': 'Opslaan',
  'admin.tenant.saved': 'Opgeslagen',
  'admin.tenant.saveError': 'Opslaan mislukt: {error}',

  // Admin — users
  'admin.users.title': 'Gebruikers',
  'admin.users.invite': 'Gebruiker uitnodigen',
  'admin.users.empty': 'Nog geen gebruikers.',
  'admin.users.col.email': 'E-mail',
  'admin.users.col.name': 'Naam',
  'admin.users.col.role': 'Rol',
  'admin.users.col.tenant': 'Tenant',
  'admin.users.invite.title': 'Gebruiker uitnodigen',
  'admin.users.invite.email': 'E-mail',
  'admin.users.invite.name': 'Naam',
  'admin.users.invite.role': 'Rol',
  'admin.users.invite.tenant': 'Tenant',
  'admin.users.invite.submit': 'Uitnodigen',
  'admin.users.invite.success': 'Uitnodiging verstuurd naar {email}.',

  // Admin — common
  'admin.role.super_admin': 'Super admin',
  'admin.role.tenant_admin': 'Tenant admin',
  'admin.error.generic': 'Er ging iets mis.',
  'admin.error.forbidden': 'Geen toegang.',
```

- [ ] **Step 2: Run i18n tests**

```bash
pnpm test tests/i18n.test.ts
```

Expected: still green (no key collisions).

- [ ] **Step 3: Commit**

```bash
git add src/lib/i18n.ts
git commit -m "feat(i18n): add admin.* key block"
```

---

## Wave 7 — Admin shell

### Task 14: `(authed)` layout with session guard + shell

**Files:**
- Create: `src/app/admin/(authed)/layout.tsx`
- Create: `src/components/admin/Sidebar.tsx`
- Create: `src/components/admin/Header.tsx`

The route group `(authed)` doesn't appear in the URL — pages inside still resolve to `/admin/...`. The guard lives on this layout, so `/admin/sign-in` (outside the group) is unaffected.

- [ ] **Step 1: Create the authed layout**

Create `src/app/admin/(authed)/layout.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/admin/Sidebar';
import { Header } from '@/components/admin/Header';
import type { Role, UserType } from '@/lib/auth-guards';

export default async function AdminAuthedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect('/admin/sign-in');
  }

  const userType = session.user.userType as UserType | null;
  if (userType !== 'business') {
    // Clients have no business in /admin — bounce them to /shop/account.
    redirect('/shop/account');
  }

  const role = session.user.role as Role;

  return (
    <div className="min-h-screen flex bg-neutral-50 text-neutral-900">
      <Sidebar role={role} tenantId={session.user.tenantId as string | null} />
      <div className="flex-1 flex flex-col">
        <Header
          name={session.user.name ?? session.user.email}
          email={session.user.email}
          role={role}
        />
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the Sidebar**

Create `src/components/admin/Sidebar.tsx`:

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t } from '@/lib/i18n';
import type { Role } from '@/lib/auth-guards';

interface Props { role: Role; tenantId: string | null }

interface NavItem { href: string; labelKey: string; visible: (role: Role) => boolean }

const ITEMS: NavItem[] = [
  { href: '/admin', labelKey: 'admin.nav.dashboard', visible: () => true },
  { href: '/admin/tenants', labelKey: 'admin.nav.tenants', visible: (r) => r === 'super_admin' },
  { href: '/admin/users', labelKey: 'admin.nav.users', visible: () => true },
];

export function Sidebar({ role, tenantId }: Props) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => i.visible(role));

  return (
    <aside className="w-60 bg-white border-r border-neutral-200 p-4 flex flex-col gap-1">
      <div className="px-3 py-2 mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {t('admin.title')}
      </div>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 rounded-md text-sm transition-colors ${
              active ? 'bg-neutral-100 font-medium' : 'hover:bg-neutral-50'
            }`}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
      {role === 'tenant_admin' && tenantId && (
        <Link
          href={`/admin/tenants/${tenantId}`}
          className={`mt-2 px-3 py-2 rounded-md text-sm transition-colors ${
            pathname.startsWith(`/admin/tenants/${tenantId}`) ? 'bg-neutral-100 font-medium' : 'hover:bg-neutral-50'
          }`}
        >
          {t('admin.nav.tenant')}
        </Link>
      )}
    </aside>
  );
}
```

- [ ] **Step 3: Create the Header**

Create `src/components/admin/Header.tsx`:

```tsx
'use client';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';
import type { Role } from '@/lib/auth-guards';

interface Props { name: string; email: string; role: Role }

export function Header({ name, email, role }: Props) {
  const router = useRouter();
  return (
    <header className="h-14 bg-white border-b border-neutral-200 flex items-center justify-between px-6">
      <div className="text-sm text-neutral-600">
        {name} <span className="text-neutral-400">·</span> {t(`admin.role.${role}`)}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-neutral-500">{email}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await signOut();
            router.push('/admin/sign-in');
          }}
        >
          {t('admin.signOut')}
        </Button>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
pnpm exec tsc --noEmit && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add 'src/app/admin/(authed)/layout.tsx' src/components/admin/Sidebar.tsx src/components/admin/Header.tsx
git commit -m "feat(admin): /admin shell — session guard via (authed) route group, role-aware sidebar, header with sign-out"
```

### Task 15: `/admin/sign-in` page

**Files:**
- Create: `src/app/admin/sign-in/layout.tsx` — minimal layout (no parent guard, since sign-in is outside the `(authed)` group).
- Create: `src/app/admin/sign-in/page.tsx`

- [ ] **Step 1: Create the sign-in layout**

Create `src/app/admin/sign-in/layout.tsx`:

```tsx
// Sign-in lives outside the (authed) group, so the session-guard layout
// doesn't apply here. We still bounce already-signed-in business users
// straight to /admin to avoid showing them the sign-in form.
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function SignInLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session && session.user.userType === 'business') redirect('/admin');
  return <div className="min-h-screen flex items-center justify-center bg-neutral-50">{children}</div>;
}
```

- [ ] **Step 2: Create the sign-in page**

Create `src/app/admin/sign-in/page.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { signIn } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { t } from '@/lib/i18n';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sent' | 'error'>('idle');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setState('idle');
    try {
      await signIn.magicLink({ email, callbackURL: '/admin' });
      setState('sent');
    } catch {
      setState('error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t('admin.signIn.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('admin.signIn.email')}</Label>
            <Input
              id="email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {t('admin.signIn.submit')}
          </Button>
          {state === 'sent' && <p className="text-sm text-green-600">{t('admin.signIn.sent')}</p>}
          {state === 'error' && <p className="text-sm text-red-600">{t('admin.signIn.error')}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Verify in browser**

```bash
pnpm dev
# Visit http://localhost:3000/admin → should redirect to /admin/sign-in
# Submit your email → check server console for the magic link (RESEND_API_KEY unset)
# Click the link → should land on /admin
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/sign-in/
git commit -m "feat(admin): magic-link sign-in page"
```

### Task 16: `/admin` dashboard

**Files:**
- Create: `src/app/admin/(authed)/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { tenants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { t } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function AdminDashboard() {
  // Layout already guarantees a business session.
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const tenantId = session.user.tenantId as string | null;
  const role = session.user.role as string;

  const [tenant] = tenantId
    ? await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
    : [];

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">
        {t('admin.dashboard.greeting', { name: session.user.name ?? session.user.email })}
      </h1>
      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent className="text-sm text-neutral-700 space-y-1">
          <p>{t('admin.dashboard.role', { role: t(`admin.role.${role}`) })}</p>
          {tenant && <p>{t('admin.dashboard.tenant', { tenant: tenant.displayName })}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

```bash
pnpm dev
# Visit http://localhost:3000/admin while signed in
```

Expected: dashboard renders with your name, role, tenant.

- [ ] **Step 3: Commit**

```bash
git add 'src/app/admin/(authed)/page.tsx'
git commit -m "feat(admin): dashboard page"
```

---

## Wave 8 — Admin pages

### Task 17: `/admin/tenants` list + create dialog (super_admin)

**Files:**
- Create: `src/app/admin/(authed)/tenants/page.tsx`
- Create: `src/components/admin/TenantsTable.tsx`
- Create: `src/components/admin/CreateTenantDialog.tsx`

- [ ] **Step 1: Create the list page**

```tsx
// src/app/admin/(authed)/tenants/page.tsx
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { tenants } from '@/db/schema';
import { TenantsTable } from '@/components/admin/TenantsTable';
import { CreateTenantDialog } from '@/components/admin/CreateTenantDialog';
import { t } from '@/lib/i18n';

export default async function TenantsPage() {
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  if (session.user.role !== 'super_admin') redirect('/admin');

  const rows = await db.select().from(tenants);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('admin.tenants.title')}</h1>
        <CreateTenantDialog />
      </div>
      <TenantsTable tenants={rows} />
    </div>
  );
}
```

- [ ] **Step 2: Create the table component**

```tsx
// src/components/admin/TenantsTable.tsx
'use client';
import Link from 'next/link';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import type { TenantRow } from '@/db/schema';
import { t } from '@/lib/i18n';

interface Props { tenants: TenantRow[] }

export function TenantsTable({ tenants }: Props) {
  if (tenants.length === 0) {
    return <p className="text-sm text-neutral-500">{t('admin.tenants.empty')}</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.tenants.col.id')}</TableHead>
          <TableHead>{t('admin.tenants.col.displayName')}</TableHead>
          <TableHead>{t('admin.tenants.col.locale')}</TableHead>
          <TableHead>{t('admin.tenants.col.currency')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tenants.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <Link href={`/admin/tenants/${row.id}`} className="font-mono text-sm underline">
                {row.id}
              </Link>
            </TableCell>
            <TableCell>{row.displayName}</TableCell>
            <TableCell>{row.locale}</TableCell>
            <TableCell>{row.currency}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 3: Create the dialog**

```tsx
// src/components/admin/CreateTenantDialog.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { t } from '@/lib/i18n';

export function CreateTenantDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [id, setId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/admin/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, displayName, locale: 'nl-BE', currency: 'EUR' }),
    });
    setSubmitting(false);
    if (res.ok) {
      setOpen(false);
      setId(''); setDisplayName('');
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(t('admin.tenants.create.error', { error: data.error ?? res.status }));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t('admin.tenants.create')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('admin.tenants.create.title')}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="id">{t('admin.tenants.create.id')}</Label>
            <Input id="id" required value={id} onChange={(e) => setId(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayName">{t('admin.tenants.create.displayName')}</Label>
            <Input id="displayName" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">
            {t('admin.tenants.create.submit')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Verify in browser**

```bash
pnpm dev
# As super_admin: visit /admin/tenants → list should show assymo + a "Nieuwe tenant" button
# Create a test tenant; verify it appears in the table
```

If the existing `POST /api/admin/tenants` requires more fields (priceBook, branding), look at `src/app/api/admin/tenants/route.ts` and either:
- pass sane defaults from the dialog (recommended), or
- have the server fill defaults when not provided.

Update the route handler if needed so that the create flow works with `{ id, displayName, locale, currency }` alone.

- [ ] **Step 5: Commit**

```bash
git add 'src/app/admin/(authed)/tenants/page.tsx' src/components/admin/TenantsTable.tsx src/components/admin/CreateTenantDialog.tsx
git commit -m "feat(admin): /admin/tenants list + create-tenant dialog"
```

### Task 18: `/admin/tenants/[id]` detail page

**Files:**
- Create: `src/app/admin/(authed)/tenants/[id]/page.tsx`
- Create: `src/components/admin/TenantDetailsSection.tsx`
- Create: `src/components/admin/HostsSection.tsx`
- Create: `src/components/admin/BrandingSection.tsx`
- Create: `src/components/admin/PriceBookSection.tsx`

- [ ] **Step 1: Create the page**

```tsx
// src/app/admin/(authed)/tenants/[id]/page.tsx
import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { tenants, tenantHosts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { TenantDetailsSection } from '@/components/admin/TenantDetailsSection';
import { HostsSection } from '@/components/admin/HostsSection';
import { BrandingSection } from '@/components/admin/BrandingSection';
import { PriceBookSection } from '@/components/admin/PriceBookSection';
import { t } from '@/lib/i18n';

export default async function TenantDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const role = session.user.role as string;
  const userTenant = session.user.tenantId as string | null;

  // Scope check
  if (role !== 'super_admin' && userTenant !== id) redirect('/admin');

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  if (!tenant) notFound();

  const hosts = await db.select().from(tenantHosts).where(eq(tenantHosts.tenantId, id));

  return (
    <div className="space-y-8 max-w-4xl">
      <h1 className="text-2xl font-semibold">{tenant.displayName}</h1>
      <TenantDetailsSection tenant={tenant} />
      <HostsSection tenantId={tenant.id} initialHosts={hosts} />
      <BrandingSection tenantId={tenant.id} initialBranding={tenant.branding} />
      <PriceBookSection tenantId={tenant.id} initialPriceBook={tenant.priceBook} />
    </div>
  );
}
```

- [ ] **Step 2: Create `TenantDetailsSection`**

```tsx
// src/components/admin/TenantDetailsSection.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TenantRow } from '@/db/schema';
import { t } from '@/lib/i18n';

interface Props { tenant: TenantRow }

export function TenantDetailsSection({ tenant }: Props) {
  return (
    <Card>
      <CardHeader><CardTitle>{t('admin.tenant.section.details')}</CardTitle></CardHeader>
      <CardContent className="text-sm text-neutral-700 space-y-1 font-mono">
        <p>id: {tenant.id}</p>
        <p>locale: {tenant.locale}</p>
        <p>currency: {tenant.currency}</p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create `HostsSection`**

```tsx
// src/components/admin/HostsSection.tsx
'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TenantHostRow } from '@/db/schema';
import { t } from '@/lib/i18n';

interface Props { tenantId: string; initialHosts: TenantHostRow[] }

export function HostsSection({ tenantId, initialHosts }: Props) {
  const [hosts, setHosts] = useState(initialHosts);
  const [hostname, setHostname] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!hostname.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/admin/tenants/${tenantId}/hosts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostname }),
    });
    setBusy(false);
    if (res.ok) {
      const { host } = await res.json();
      setHosts((prev) => [...prev, host]);
      setHostname('');
    }
  }

  async function remove(h: string) {
    setBusy(true);
    const res = await fetch(
      `/api/admin/tenants/${tenantId}/hosts/${encodeURIComponent(h)}`,
      { method: 'DELETE' },
    );
    setBusy(false);
    if (res.ok) setHosts((prev) => prev.filter((row) => row.hostname !== h));
  }

  return (
    <Card>
      <CardHeader><CardTitle>{t('admin.tenant.section.hosts')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder={t('admin.tenant.hosts.placeholder')}
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
          />
          <Button onClick={add} disabled={busy || !hostname.trim()}>
            {t('admin.tenant.hosts.add')}
          </Button>
        </div>
        {hosts.length === 0 ? (
          <p className="text-sm text-neutral-500">{t('admin.tenant.hosts.empty')}</p>
        ) : (
          <ul className="space-y-1">
            {hosts.map((h) => (
              <li key={h.hostname} className="flex items-center justify-between text-sm font-mono">
                {h.hostname}
                <Button size="sm" variant="ghost" onClick={() => remove(h.hostname)}>
                  {t('admin.tenant.hosts.delete')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create `BrandingSection`**

```tsx
// src/components/admin/BrandingSection.tsx
'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Branding } from '@/domain/tenant';
import { t } from '@/lib/i18n';

interface Props { tenantId: string; initialBranding: Branding }

export function BrandingSection({ tenantId, initialBranding }: Props) {
  const [b, setB] = useState(initialBranding);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function set<K extends keyof Branding>(k: K, v: Branding[K]) {
    setB((prev) => ({ ...prev, [k]: v }));
  }
  function setFooter<K extends keyof Branding['footer']>(k: K, v: Branding['footer'][K]) {
    setB((prev) => ({ ...prev, footer: { ...prev.footer, [k]: v } }));
  }

  async function save() {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/admin/tenants/${tenantId}/branding`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(b),
    });
    setBusy(false);
    if (res.ok) setMsg(t('admin.tenant.saved'));
    else {
      const data = await res.json().catch(() => ({}));
      setMsg(t('admin.tenant.saveError', { error: data.error ?? res.status }));
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>{t('admin.tenant.section.branding')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Field label={t('admin.tenant.branding.displayName')}>
          <Input value={b.displayName} onChange={(e) => set('displayName', e.target.value)} />
        </Field>
        <Field label={t('admin.tenant.branding.logoUrl')}>
          <Input value={b.logoUrl} onChange={(e) => set('logoUrl', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('admin.tenant.branding.primaryColor')}>
            <Input value={b.primaryColor} onChange={(e) => set('primaryColor', e.target.value)} />
          </Field>
          <Field label={t('admin.tenant.branding.accentColor')}>
            <Input value={b.accentColor} onChange={(e) => set('accentColor', e.target.value)} />
          </Field>
        </div>
        <Field label={t('admin.tenant.branding.footer.contactEmail')}>
          <Input value={b.footer.contactEmail} onChange={(e) => setFooter('contactEmail', e.target.value)} />
        </Field>
        <Field label={t('admin.tenant.branding.footer.address')}>
          <Input value={b.footer.address} onChange={(e) => setFooter('address', e.target.value)} />
        </Field>
        <Field label={t('admin.tenant.branding.footer.vatNumber')}>
          <Input
            value={b.footer.vatNumber ?? ''}
            onChange={(e) => setFooter('vatNumber', e.target.value || null)}
          />
        </Field>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={busy}>{t('admin.tenant.save')}</Button>
          {msg && <span className="text-sm text-neutral-600">{msg}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Create `PriceBookSection`** — pragmatic JSON editor for now

The price book has many scalar dials. For Phase 1 we ship a JSON textarea editor; a structured form is a Phase 1.x polish.

```tsx
// src/components/admin/PriceBookSection.tsx
'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { PriceBook } from '@/domain/pricing';
import { t } from '@/lib/i18n';

interface Props { tenantId: string; initialPriceBook: PriceBook }

export function PriceBookSection({ tenantId, initialPriceBook }: Props) {
  const [text, setText] = useState(JSON.stringify(initialPriceBook, null, 2));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setMsg(null);
    let parsed: unknown;
    try { parsed = JSON.parse(text); }
    catch { setMsg(t('admin.tenant.saveError', { error: 'invalid_json' })); return; }
    setBusy(true);
    const res = await fetch(`/api/admin/tenants/${tenantId}/price-book`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    });
    setBusy(false);
    if (res.ok) setMsg(t('admin.tenant.saved'));
    else {
      const data = await res.json().catch(() => ({}));
      setMsg(t('admin.tenant.saveError', { error: data.error ?? res.status }));
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>{t('admin.tenant.section.priceBook')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={20}
          className="w-full font-mono text-xs p-3 rounded-md border border-neutral-200 bg-white"
        />
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={busy}>{t('admin.tenant.save')}</Button>
          {msg && <span className="text-sm text-neutral-600">{msg}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Verify in browser**

```bash
pnpm dev
# Visit /admin/tenants/assymo
# Test each section: add a host, change a branding color, tweak price book JSON
```

- [ ] **Step 7: Commit**

```bash
git add 'src/app/admin/(authed)/tenants/[id]/page.tsx' src/components/admin/TenantDetailsSection.tsx src/components/admin/HostsSection.tsx src/components/admin/BrandingSection.tsx src/components/admin/PriceBookSection.tsx
git commit -m "feat(admin): /admin/tenants/[id] detail with details/hosts/branding/price-book sections"
```

### Task 19: `/admin/users` list + invite dialog

**Files:**
- Create: `src/app/admin/(authed)/users/page.tsx`
- Create: `src/components/admin/UsersTable.tsx`
- Create: `src/components/admin/InviteUserDialog.tsx`

- [ ] **Step 1: Create the page**

```tsx
// src/app/admin/(authed)/users/page.tsx
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { tenants } from '@/db/schema';
import { UsersTable } from '@/components/admin/UsersTable';
import { InviteUserDialog } from '@/components/admin/InviteUserDialog';
import { t } from '@/lib/i18n';

export default async function UsersPage() {
  const session = (await auth.api.getSession({ headers: await headers() }))!;
  const role = session.user.role as string;
  const tenantId = session.user.tenantId as string | null;

  // For super_admin we need the full tenant list to populate the invite dialog.
  const allTenants = role === 'super_admin' ? await db.select().from(tenants) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('admin.users.title')}</h1>
        <InviteUserDialog
          actorRole={role as 'super_admin' | 'tenant_admin'}
          actorTenantId={tenantId}
          tenantOptions={allTenants.map((tx) => ({ id: tx.id, displayName: tx.displayName }))}
        />
      </div>
      <UsersTable />
    </div>
  );
}
```

- [ ] **Step 2: Create the table**

```tsx
// src/components/admin/UsersTable.tsx
'use client';
import { useEffect, useState } from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { t } from '@/lib/i18n';

interface Row {
  id: string; email: string; name: string | null;
  role: string; tenantId: string | null;
}

export function UsersTable() {
  const [users, setUsers] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch('/api/admin/users').then(async (r) => {
      if (r.ok) {
        const { users } = await r.json();
        setUsers(users);
      }
    });
  }, []);

  if (users === null) return <p className="text-sm text-neutral-500">…</p>;
  if (users.length === 0) return <p className="text-sm text-neutral-500">{t('admin.users.empty')}</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.users.col.email')}</TableHead>
          <TableHead>{t('admin.users.col.name')}</TableHead>
          <TableHead>{t('admin.users.col.role')}</TableHead>
          <TableHead>{t('admin.users.col.tenant')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((u) => (
          <TableRow key={u.id}>
            <TableCell>{u.email}</TableCell>
            <TableCell>{u.name ?? '—'}</TableCell>
            <TableCell>{t(`admin.role.${u.role}`)}</TableCell>
            <TableCell className="font-mono text-xs">{u.tenantId ?? '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 3: Create the invite dialog**

```tsx
// src/components/admin/InviteUserDialog.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { t } from '@/lib/i18n';

interface Props {
  actorRole: 'super_admin' | 'tenant_admin';
  actorTenantId: string | null;
  tenantOptions: { id: string; displayName: string }[];
}

export function InviteUserDialog({ actorRole, actorTenantId, tenantOptions }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'super_admin' | 'tenant_admin'>('tenant_admin');
  const [tenantId, setTenantId] = useState<string>(actorTenantId ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, role, tenantId: role === 'super_admin' ? null : tenantId }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg(t('admin.users.invite.success', { email }));
      setEmail(''); setName('');
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMsg(`${t('admin.error.generic')} (${data.error ?? res.status})`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t('admin.users.invite')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('admin.users.invite.title')}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('admin.users.invite.email')}</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">{t('admin.users.invite.name')}</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">{t('admin.users.invite.role')}</Label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'super_admin' | 'tenant_admin')}
              className="w-full h-9 rounded-md border border-neutral-200 px-3 text-sm"
            >
              <option value="tenant_admin">{t('admin.role.tenant_admin')}</option>
              {actorRole === 'super_admin' && (
                <option value="super_admin">{t('admin.role.super_admin')}</option>
              )}
            </select>
          </div>
          {actorRole === 'super_admin' && role !== 'super_admin' && (
            <div className="space-y-2">
              <Label htmlFor="tenantId">{t('admin.users.invite.tenant')}</Label>
              <select
                id="tenantId"
                required
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="w-full h-9 rounded-md border border-neutral-200 px-3 text-sm"
              >
                <option value="">—</option>
                {tenantOptions.map((tx) => (
                  <option key={tx.id} value={tx.id}>{tx.displayName} ({tx.id})</option>
                ))}
              </select>
            </div>
          )}
          {msg && <p className="text-sm text-neutral-600">{msg}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {t('admin.users.invite.submit')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Verify in browser**

```bash
pnpm dev
# Visit /admin/users
# As super_admin: invite a tenant_admin in some tenant, see it appear in the list
# Sign in as that user via the magic link → should be able to load /admin
```

- [ ] **Step 5: Commit**

```bash
git add 'src/app/admin/(authed)/users/page.tsx' src/components/admin/UsersTable.tsx src/components/admin/InviteUserDialog.tsx
git commit -m "feat(admin): /admin/users list + invite-user dialog"
```

---

## Wave 9 — Docs

### Task 20: Update CLAUDE.md + ROADMAP.md

**Files:**
- Modify: `CLAUDE.md`
- Modify: `ROADMAP.md`

- [ ] **Step 1: Update CLAUDE.md**

In `CLAUDE.md`:

- Wherever the role list `super_admin | tenant_admin | staff` appears, change to `super_admin | tenant_admin`.
- Add a sentence under the Better Auth bullet noting `userType: 'business' | 'client'` and that `/api/admin/*` requires `userType=business`.
- Add the new admin endpoints to the API surface bullet:
  - `GET /api/admin/users`
  - `GET /api/admin/tenants`, `GET /api/admin/tenants/[id]`
  - `GET/POST /api/admin/tenants/[id]/hosts`, `DELETE /api/admin/tenants/[id]/hosts/[hostname]`
  - `PATCH /api/admin/tenants/[id]/branding`
- Add the `branding` column to the `tenants` description in `src/db/schema.ts` paragraph.

- [ ] **Step 2: Update ROADMAP.md**

Replace the "Phase 1 — Admin UI (next)" block with a short pointer:

```markdown
## Phase 1 — Admin foundation (in progress)

Detailed spec + plan:
- Spec: `docs/superpowers/specs/2026-04-17-platform-architecture-design.md`
- Plan: `docs/superpowers/plans/2026-04-17-phase-1-admin-foundation.md`

Spec progress is tracked at the bottom of the spec.
```

Mark in the "Current state" section: "Phase 1 — Admin foundation: in progress."

- [ ] **Step 3: Tick the spec progress**

When all preceding tasks are merged and the admin surface is verified end-to-end, edit `docs/superpowers/specs/2026-04-17-platform-architecture-design.md` and tick `[x] Phase 1 — Admin foundation`.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md ROADMAP.md docs/superpowers/specs/2026-04-17-platform-architecture-design.md
git commit -m "docs: reflect Phase 1 admin foundation (userType, role changes, new endpoints)"
```

---

## Final verification

After Task 20:

- [ ] `pnpm test` — green (133+ tests, including new auth-guards + branding cases)
- [ ] `pnpm exec tsc --noEmit` — clean
- [ ] `pnpm build` — clean
- [ ] Manual end-to-end on `pnpm dev`:
  - Visit `/admin` while signed out → redirects to `/admin/sign-in`
  - Submit email, click magic link from server console → land on `/admin`
  - As super_admin: navigate to `/admin/tenants`, create a new tenant
  - Visit the new tenant detail, add a host, edit branding, edit price book
  - As super_admin: visit `/admin/users`, invite a tenant_admin
  - Sign out, sign in as the invited tenant_admin via magic link
  - Confirm `/admin/tenants` is hidden in sidebar (super_admin only)
  - Confirm "Mijn tenant" link is visible and goes to that tenant's detail page
  - Confirm tenant_admin cannot reach a different tenant's detail page (redirect to `/admin`)

---

## Out of scope for Phase 1 (deferred)

These are intentionally not part of this plan; they land with the phases that introduce their data:

- `/admin/clients` and `GET /api/admin/clients` — Phase 2 (no client users exist until orders auto-create them).
- `/admin/orders` and order endpoints — Phase 2.
- `/admin/registry` (material catalog toggles) — Phase 4.5.
- `/admin/invoices` and invoice endpoints — Phase 5.
- Structured price-book editor (replacing the JSON textarea) — Phase 1.x polish if it's painful.
- Branded magic-link email per tenant — cross-cutting (becomes urgent once a second tenant is live).
- Integration tests against a real Neon branch — cross-cutting; promote before Phase 2 if refactor velocity drops.
