'use client';
import { useAdminHeaderTitle } from '@/components/admin/AdminHeaderContext';

export function PageTitle({ title }: { title: string }) {
  useAdminHeaderTitle(title);
  return null;
}
