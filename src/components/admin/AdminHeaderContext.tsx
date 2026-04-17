'use client';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

interface AdminHeaderContextType {
  actions: ReactNode;
  setActions: (actions: ReactNode) => void;
  title: string | null;
  setTitle: (title: string | null) => void;
}

const AdminHeaderContext = createContext<AdminHeaderContextType | null>(null);

export function AdminHeaderProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<ReactNode>(null);
  const [title, setTitle] = useState<string | null>(null);

  return (
    <AdminHeaderContext.Provider value={{ actions, setActions, title, setTitle }}>
      {children}
    </AdminHeaderContext.Provider>
  );
}

/** Register actions to render on the right side of the admin header.
 *  Cleared automatically on unmount. */
export function useAdminHeaderActions(actions: ReactNode) {
  const ctx = useContext(AdminHeaderContext);
  if (!ctx) {
    throw new Error('useAdminHeaderActions must be used within AdminHeaderProvider');
  }
  const { setActions } = ctx;
  useEffect(() => {
    setActions(actions);
    return () => setActions(null);
  }, [actions, setActions]);
}

/** Register a title to render in the header next to the sidebar trigger.
 *  Cleared automatically on unmount. */
export function useAdminHeaderTitle(title: string | null) {
  const ctx = useContext(AdminHeaderContext);
  if (!ctx) {
    throw new Error('useAdminHeaderTitle must be used within AdminHeaderProvider');
  }
  const { setTitle } = ctx;
  useEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [title, setTitle]);
}

/** Read the current header title (used by Header). */
export function useAdminHeaderTitleValue(): string | null {
  return useContext(AdminHeaderContext)?.title ?? null;
}

/** Render slot for the registered actions. */
export function AdminHeaderActions() {
  const ctx = useContext(AdminHeaderContext);
  if (!ctx) return null;
  return <>{ctx.actions}</>;
}
