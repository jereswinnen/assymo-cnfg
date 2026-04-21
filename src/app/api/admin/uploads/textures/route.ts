import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { requireBusiness } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 5;

/** Signed-token issuer for direct Blob uploads. The browser calls this
 *  endpoint twice per file: once to request a token, once (via the
 *  Blob SDK) to report completion. Both go through `withSession` so
 *  tokens are never issued to anonymous callers. Upload paths are
 *  namespaced per tenant via the `textures/<tenantId>/…` prefix. */
export const POST = withSession(async (session, req) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);

  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const expectedPrefix = `textures/${session.user.tenantId ?? 'shared'}/`;
        if (!pathname.startsWith(expectedPrefix)) {
          throw new Error('invalid_path');
        }
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_SIZE_MB * 1024 * 1024,
          tokenPayload: JSON.stringify({
            userId: session.user.id,
            tenantId: session.user.tenantId,
          }),
        };
      },
      onUploadCompleted: async () => {
        // No-op: the row is updated via the material POST/PATCH endpoints
        // using the Blob URL returned to the client.
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'upload_failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
});
