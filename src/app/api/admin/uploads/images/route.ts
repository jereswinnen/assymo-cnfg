import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { requireBusiness } from '@/lib/auth-guards';
import { withSession } from '@/lib/auth-session';

// SVG is allowed here (tenant logos, hero images) because the client
// renders them via <img src=…>, which runs SVG in "secure mode" (no
// scripts, no external fetches). Blob URLs also live on a different
// origin than the app, so session cookies aren't reachable even in
// the contrived case script execution did occur. Do NOT enable SVG
// for /textures or /supplier-images — those go onto three.js
// materials that can't render vector anyway.
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const MAX_SIZE_MB = 5;

/** Signed-token issuer for direct Blob uploads of product hero images.
 *  Path-namespaced per tenant as `images/<tenantId>/…`. Mirrors the
 *  textures endpoint's shape exactly; separated by path for audit
 *  clarity + to let future content-type limits diverge if needed. */
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
        // super_admin (tenantId=null post-kind-refactor) may upload to any
        // tenant's namespace; tenant_admin is pinned to their own tenant.
        if (session.user.kind === 'super_admin') {
          if (!pathname.startsWith('images/')) throw new Error('invalid_path');
        } else {
          const expectedPrefix = `images/${session.user.tenantId}/`;
          if (!pathname.startsWith(expectedPrefix)) throw new Error('invalid_path');
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
      // No onUploadCompleted: we don't need a server-side callback (the
      // row is updated via POST/PATCH using the Blob URL returned to
      // the client). Defining it forces handleUpload to register a
      // public webhook URL, which fails on localhost.
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'upload_failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
});
