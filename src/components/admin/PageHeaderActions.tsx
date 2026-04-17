'use client';
import type { ReactNode } from 'react';
import { useAdminHeaderActions } from '@/components/admin/AdminHeaderContext';

export function PageHeaderActions({ children }: { children: ReactNode }) {
  useAdminHeaderActions(children);
  return null;
}
