import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth, type Session } from './auth';
import { AuthError } from './auth-guards';

/** Convert any thrown error into a JSON response. */
export function toAuthErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.code }, { status: err.status });
  }
  throw err;
}

/** Fetch the current Better Auth session from the request headers.
 *  Throws AuthError('unauthenticated', 401) when there is none. */
export async function requireSession(): Promise<Session> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new AuthError('unauthenticated', 401);
  return session;
}

/** Wrap a route handler so it requires a session. The handler receives
 *  the resolved session as its first argument; any AuthError thrown
 *  inside turns into the matching JSON response. */
export function withSession<TCtx>(
  handler: (session: Session, req: Request, ctx: TCtx) => Promise<Response>,
): (req: Request, ctx: TCtx) => Promise<Response> {
  return async (req, ctx) => {
    try {
      const session = await requireSession();
      return await handler(session, req, ctx);
    } catch (err) {
      return toAuthErrorResponse(err);
    }
  };
}
