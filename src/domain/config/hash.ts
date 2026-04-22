import type { ConfigData } from './types';

/** Stable JSON-stringify with sorted object keys at every level, so two
 *  ConfigData values that are structurally equal always produce the
 *  same string. Used as the pre-image for `contentHash`. */
export function canonicalizeConfig(cfg: ConfigData): string {
  return stringifyStable(cfg);
}

function stringifyStable(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stringifyStable).join(',') + ']';
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + stringifyStable((v as Record<string, unknown>)[k]))
      .join(',') +
    '}'
  );
}

/** SHA-256 of the canonicalised config, hex-encoded. Used to dedupe
 *  identical scenes inside `POST /api/configs` (unique index on
 *  `(tenant_id, content_hash)`). Web Crypto is available in both Node 20+
 *  and the Edge runtime; no Node-only imports. */
export async function contentHash(cfg: ConfigData): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalizeConfig(cfg));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
