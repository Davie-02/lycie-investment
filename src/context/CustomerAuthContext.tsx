import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ApiError } from "@/services/http";
import {
  clearCustomerSession,
  getStoredCustomer,
  loginCustomer,
  logoutCustomer,
  registerCustomer,
  storeCustomerSession,
  CUSTOMER_SESSION_EXPIRED_EVENT,
  type CustomerSession,
  type CustomerUser,
} from "@/services/customer.service";

interface CustomerAuthContextValue {
  isAuthenticated: boolean;
  currentUser: CustomerUser | null;
  isSubmitting: boolean;
  errorMessage: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateCurrentUser: (user: CustomerUser) => void;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);
const CUSTOMER_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getStoredCustomer()));
  const [currentUser, setCurrentUser] = useState<CustomerUser | null>(() => getStoredCustomer());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    let timeoutId: number;
    const resetTimeout = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        // Clears the local UI state immediately, and also tells the server
        // to invalidate the actual session cookie — without this second
        // part, the cookie stays valid until its full expiry even though
        // the UI shows "logged out", which would let anyone still using
        // this browser continue making authenticated requests.
        void logoutCustomer().catch(() => {
          // Logout failing shouldn't block clearing the local session below
          // — the cookie will still expire on its own via JWT_EXPIRES_IN.
        });
        clearCustomerSession();
        setCurrentUser(null);
        setIsAuthenticated(false);
        setErrorMessage("Your session expired after 30 minutes of inactivity.");
      }, CUSTOMER_IDLE_TIMEOUT_MS);
    };

    const activityEvents = ["click", "keydown", "pointermove", "scroll", "touchstart"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetTimeout));
    resetTimeout();

    return () => {
      window.clearTimeout(timeoutId);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetTimeout));
    };
  }, [isAuthenticated]);

  useEffect(() => {
    function handleExpiredSession() {
      setCurrentUser(null);
      setIsAuthenticated(false);
      setErrorMessage("Your session has expired. Please sign in again.");
    }

    window.addEventListener(CUSTOMER_SESSION_EXPIRED_EVENT, handleExpiredSession);
    return () => window.removeEventListener(CUSTOMER_SESSION_EXPIRED_EVENT, handleExpiredSession);
  }, []);

  async function authenticate(request: () => Promise<CustomerSession>) {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const session = await request();
      storeCustomerSession(session);
      setCurrentUser(session.user);
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  function login(email: string, password: string) {
    return authenticate(() => loginCustomer(email, password));
  }

  function register(name: string, email: string, password: string) {
    return authenticate(() => registerCustomer(name, email, password));
  }

  function logout() {
    void logoutCustomer();
    clearCustomerSession();
    setCurrentUser(null);
    setIsAuthenticated(false);
  }

  // Called after a successful profile edit so the header greeting and
  // localStorage-backed session reflect the new name/email immediately,
  // without forcing a re-login.
  function updateCurrentUser(user: CustomerUser) {
    storeCustomerSession({ user });
    setCurrentUser(user);
  }

  return (
    <CustomerAuthContext.Provider
      value={{
        isAuthenticated,
        currentUser,
        isSubmitting,
        errorMessage,
        login,
        register,
        logout,
        updateCurrentUser,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth(): CustomerAuthContextValue {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error("useCustomerAuth must be used within a CustomerAuthProvider.");
  }
  return context;
}