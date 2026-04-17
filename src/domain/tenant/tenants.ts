import type { TenantId } from './types';

/** Slug used as the fallback tenant id when host resolution yields
 *  nothing. The `assymo` row is seeded by `pnpm db:seed`. */
export const DEFAULT_TENANT_ID: TenantId = 'assymo';
