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

  return (
    <CustomerAuthContext.Provider
      value={{ isAuthenticated, currentUser, isSubmitting, errorMessage, login, register, logout }}
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