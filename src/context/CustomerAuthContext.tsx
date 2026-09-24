import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ApiError } from "@/services/http";
import {
  clearCustomerSession,
  fetchCustomerSession,
  getStoredCustomer,
  isCustomerRemembered,
  loginCustomer,
  loginWithFacebook,
  loginWithGoogle,
  logoutCustomer,
  registerCustomer,
  signInAnyone,
  storeCustomerSession,
  CUSTOMER_SESSION_EXPIRED_EVENT,
  type CustomerSession,
  type CustomerUser,
  type SignInOutcome,
} from "@/services/customer.service";

interface CustomerAuthContextValue {
  isAuthenticated: boolean;
  currentUser: CustomerUser | null;
  isSubmitting: boolean;
  errorMessage: string | null;
  login: (email: string, password: string, remember?: boolean) => Promise<boolean>;
  /** The shared customer/staff sign-in; null = failed (see errorMessage). */
  signIn: (email: string, password: string, remember?: boolean) => Promise<SignInOutcome | null>;
  register: (name: string, email: string, password: string, remember?: boolean, referralCode?: string) => Promise<boolean>;
  /** "Continue with Google" — `credential` is the ID token Google's button returns. */
  loginGoogle: (credential: string, remember?: boolean) => Promise<boolean>;
  /** "Continue with Facebook" — `accessToken` comes from Facebook's login dialog. */
  loginFacebook: (accessToken: string, remember?: boolean) => Promise<boolean>;
  logout: () => void;
  updateCurrentUser: (user: CustomerUser) => void;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);

/** Signed-in customers who did NOT tick "Keep me signed in" are logged out after this much inactivity. */
const CUSTOMER_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getStoredCustomer()));
  const [currentUser, setCurrentUser] = useState<CustomerUser | null>(() => getStoredCustomer());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // The stored user only says "someone signed in here once". Confirm with the
  // server that the session is still alive — a browser-session cookie dies when
  // the browser closes, and a remembered one can be revoked (password change,
  // deactivation). Done silently: no error banner for a returning visitor.
  useEffect(() => {
    if (!getStoredCustomer()) return;
    let cancelled = false;
    fetchCustomerSession()
      .then((user) => {
        if (cancelled) return;
        if (user) {
          storeCustomerSession({ user });
          setCurrentUser(user);
        } else {
          clearCustomerSession();
          setCurrentUser(null);
          setIsAuthenticated(false);
        }
      })
      .catch(() => {
        // Server unreachable: keep the last known state rather than signing them out over a bad signal.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Idle logout — skipped entirely for "Keep me signed in" sessions.
  useEffect(() => {
    if (!isAuthenticated || isCustomerRemembered()) return;

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
          // — the cookie will still expire on its own.
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

  /** Runs any sign-in request and, on success, records the session; on failure shows the server's message. */
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

  const login = (email: string, password: string, remember = false) => authenticate(() => loginCustomer(email, password, remember));

  /**
   * The website's shared sign-in: customers are signed in here; staff are
   * handed to the workspace (outcome "staff") or need a further step.
   */
  async function signIn(email: string, password: string, remember = false): Promise<SignInOutcome | null> {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const outcome = await signInAnyone(email, password, remember);
      if (outcome.kind === "customer") {
        storeCustomerSession(outcome.session);
        setCurrentUser(outcome.session.user);
        setIsAuthenticated(true);
      } else if (outcome.kind === "staff") {
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
      return outcome;
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }

  const register = (name: string, email: string, password: string, remember = false, referralCode?: string) =>
    authenticate(() => registerCustomer(name, email, password, remember, referralCode));
  const loginGoogle = (credential: string, remember = false) => authenticate(() => loginWithGoogle(credential, remember));
  const loginFacebook = (accessToken: string, remember = false) => authenticate(() => loginWithFacebook(accessToken, remember));

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
        signIn,
        register,
        loginGoogle,
        loginFacebook,
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
