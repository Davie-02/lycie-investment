import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { getSavedVehicles, saveVehicle, unsaveVehicle, type SavedVehicle } from "@/services/customer.service";

interface SavedVehiclesContextValue {
  savedVehicles: SavedVehicle[];
  isSaved: (vehicleId: string) => boolean;
  toggle: (vehicleId: string) => Promise<void>;
  isPending: (vehicleId: string) => boolean;
}

const SavedVehiclesContext = createContext<SavedVehiclesContextValue | null>(null);

export function SavedVehiclesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useCustomerAuth();
  const [savedVehicles, setSavedVehicles] = useState<SavedVehicle[]>([]);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthenticated) {
      setSavedVehicles([]);
      return;
    }
    getSavedVehicles()
      .then(setSavedVehicles)
      .catch(() => {
        // A failed background fetch shouldn't break the page — the save
        // button will just show as "unsaved" until the next successful load.
      });
  }, [isAuthenticated]);

  const isSaved = useCallback(
    (vehicleId: string) => savedVehicles.some((entry) => entry.vehicleId === vehicleId),
    [savedVehicles]
  );

  const isPending = useCallback((vehicleId: string) => pendingIds.has(vehicleId), [pendingIds]);

  const toggle = useCallback(
    async (vehicleId: string) => {
      if (!isAuthenticated || pendingIds.has(vehicleId)) return;

      setPendingIds((prev) => new Set(prev).add(vehicleId));
      const alreadySaved = savedVehicles.some((entry) => entry.vehicleId === vehicleId);

      try {
        if (alreadySaved) {
          await unsaveVehicle(vehicleId);
          setSavedVehicles((prev) => prev.filter((entry) => entry.vehicleId !== vehicleId));
        } else {
          const entry = await saveVehicle(vehicleId);
          setSavedVehicles((prev) => [entry, ...prev]);
        }
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(vehicleId);
          return next;
        });
      }
    },
    [isAuthenticated, pendingIds, savedVehicles]
  );

  return (
    <SavedVehiclesContext.Provider value={{ savedVehicles, isSaved, toggle, isPending }}>
      {children}
    </SavedVehiclesContext.Provider>
  );
}

export function useSavedVehicles(): SavedVehiclesContextValue {
  const context = useContext(SavedVehiclesContext);
  if (!context) {
    throw new Error("useSavedVehicles must be used within a SavedVehiclesProvider.");
  }
  return context;
}
