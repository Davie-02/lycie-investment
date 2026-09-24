/**
 * Everything the customer portal's sections share, loaded once when the portal
 * opens (balance and history, shipments, requests, unread messages) and kept
 * current: staff updates to shipments or bookings arrive live, and each section
 * can ask for a reload after the customer changes something.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  getCustomerAccount,
  getCustomerCases,
  getMyMessages,
  getMyRequests,
  type CustomerAccount,
  type CustomerCase,
  type CustomerRequestSummary,
} from "@/services/customer.service";
import { subscribeLive } from "@/services/liveContent";
import { ApiError } from "@/services/http";

interface PortalData {
  account: CustomerAccount | null;
  cases: CustomerCase[];
  requests: CustomerRequestSummary[];
  unreadMessages: number;
  isLoading: boolean;
  loadError: string | null;
  reloadAccount: () => Promise<void>;
  reloadActivity: () => Promise<void>;
  setRequests: (update: (prev: CustomerRequestSummary[]) => CustomerRequestSummary[]) => void;
  setUnreadMessages: (count: number) => void;
}

const PortalContext = createContext<PortalData | null>(null);

export function PortalProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [cases, setCases] = useState<CustomerCase[]>([]);
  const [requests, setRequestsState] = useState<CustomerRequestSummary[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reloadAccount = useCallback(async () => {
    setAccount(await getCustomerAccount());
  }, []);

  const reloadActivity = useCallback(async () => {
    const [loadedCases, loadedRequests] = await Promise.all([getCustomerCases(), getMyRequests()]);
    setCases(loadedCases);
    setRequestsState(loadedRequests);
  }, []);

  useEffect(() => {
    Promise.all([reloadAccount(), reloadActivity(), getMyMessages().then((data) => setUnreadMessages(data.unread))])
      .catch((error: unknown) => setLoadError(error instanceof ApiError ? error.message : "Unable to load your account."))
      .finally(() => setIsLoading(false));
  }, [reloadAccount, reloadActivity]);

  // Shipment and booking updates from staff appear as soon as they're posted.
  useEffect(() => subscribeLive(["shipments", "hire-vehicles"], () => void reloadActivity().catch(() => undefined)), [reloadActivity]);

  const setRequests = useCallback((update: (prev: CustomerRequestSummary[]) => CustomerRequestSummary[]) => setRequestsState(update), []);

  return (
    <PortalContext.Provider
      value={{ account, cases, requests, unreadMessages, isLoading, loadError, reloadAccount, reloadActivity, setRequests, setUnreadMessages }}
    >
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal(): PortalData {
  const context = useContext(PortalContext);
  if (!context) throw new Error("usePortal must be used inside the customer portal.");
  return context;
}
