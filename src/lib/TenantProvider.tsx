'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { TenantContext } from '@/domain/tenant';

const Ctx = createContext<TenantContext | null>(null);

export function TenantProvider({
  value,
  children,
}: {
  value: TenantContext;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTenant(): TenantContext {
  const tenant = useContext(Ctx);
  if (!tenant) throw new Error('useTenant must be used within <TenantProvider>');
  return tenant;
}
