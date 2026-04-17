/** Build an ordered list of candidate keys to look up a host against in
 *  the `tenant_hosts` table. Most requests hit on the first candidate
 *  (exact match); ports and subdomains are tried as fallbacks.
 *
 *  Priority:
 *    1. full normalized host including port ("localhost:3000", "shop.partner.be")
 *    2. bare host without port ("localhost", "shop.partner.be")
 *    3. leftmost subdomain label for 3+ part hosts ("partner" in
 *       "partner.configurator.com") — supports wildcard-ish mapping of
 *       `partner` to one tenant across any multi-label parent domain
 *
 *  All candidates are lowercase. Duplicates are dropped while preserving
 *  order (exact hosts like `localhost:3000` and `localhost` may collide
 *  in edge cases). */
export function candidateHostKeys(host: string | null | undefined): string[] {
  if (!host) return [];
  const normalized = host.toLowerCase();
  const bare = normalized.split(':')[0] ?? normalized;
  const parts = bare.split('.');

  const keys: string[] = [];
  const push = (key: string) => {
    if (key && !keys.includes(key)) keys.push(key);
  };

  push(normalized);
  push(bare);
  if (parts.length >= 3) push(parts[0]);

  return keys;
}
