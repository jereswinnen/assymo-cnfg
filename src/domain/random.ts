/** Cross-runtime UUID v4. Prefers `crypto.randomUUID()` (Node 19+,
 *  modern browsers) and falls back to `crypto.getRandomValues`-driven
 *  generation when randomUUID is missing — notably Safari < 15.4 on
 *  iPad/iOS, which still appears in the wild. Last resort is Math.random,
 *  used only when no crypto API is available at all (effectively never
 *  in environments we care about). Returns a 36-character v4 UUID. */
export function randomId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) {
    return c.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  // Per RFC 4122 §4.4: set version (high nibble of byte 6) and variant
  // (high two bits of byte 8).
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex: string[] = [];
  for (let i = 0; i < 16; i++) hex.push(bytes[i].toString(16).padStart(2, '0'));
  return (
    hex.slice(0, 4).join('') + '-' +
    hex.slice(4, 6).join('') + '-' +
    hex.slice(6, 8).join('') + '-' +
    hex.slice(8, 10).join('') + '-' +
    hex.slice(10, 16).join('')
  );
}
