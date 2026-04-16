import { createAuthClient } from 'better-auth/react';
import { magicLinkClient } from 'better-auth/client/plugins';

/** Client-side auth helpers. Safe to import from any client component:
 *    `import { signIn, signOut, useSession } from '@/lib/auth-client'`
 *
 *  Base URL is inferred from `BETTER_AUTH_URL` at runtime when rendered
 *  server-side, and from `window.location.origin` in the browser. */
export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
