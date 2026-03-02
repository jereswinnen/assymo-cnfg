'use client';

import { createContext, useContext } from 'react';

const BuildingContext = createContext<string | null>(null);

export const BuildingProvider = BuildingContext.Provider;

export function useBuildingId(): string {
  const id = useContext(BuildingContext);
  if (id === null) throw new Error('useBuildingId must be used within a BuildingProvider');
  return id;
}
