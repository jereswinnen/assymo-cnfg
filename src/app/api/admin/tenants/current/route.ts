import { NextResponse } from 'next/server';
import { getTenantById } from '@/db/resolveTenant';
import { withSession } from '@/lib/auth-session';
import { requireBusiness } from '@/lib/auth-guards';

/** Return the tenant row for the current session. super_admins without
 *  a tenant assignment get `{ tenant: null }`; other roles always have
 *  a tenantId (enforced at user creation). */
export const GET = withSession(async (session) => {
  requireBusiness(session, ['super_admin', 'tenant_admin']);
  const tenantId = session.user.tenantId as string | null | undefined;
  if (!tenantId) {
    return NextResponse.json({ tenant: null });
  }
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });
  }
  return NextResponse.json({ tenant });
});
