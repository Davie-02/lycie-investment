import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  adminLogin,
  adminLoginTwoFactor,
  clearAdminToken,
  fetchAdminSession,
  getStoredUser,
  isAdminRemembered,
  setStoredUser,
  clearStoredUser,
  type AdminUserSummary,
} from "../adminApi";
import { ApiError } from "@/services/http";

interface AdminAuthContextValue {
  isAuthenticated: boolean;
  currentUser: AdminUserSummary | null;
  isLoggingIn: boolean;
  loginError: string | null;
  /** True once the password was accepted but an authenticator code is still needed. */
  needsTwoFactor: boolean;
  /** "Keep me signed in" was chosen for this session (the 5-minute idle logout is skipped). */
  isRemembered: boolean;
  /** Returns true only when fully signed in (false = wrong details, or waiting for the 2FA code). */
  login: (email: string, password: string, remember: boolean) => Promise<boolean>;
  submitTwoFactor: (code: string) => Promise<boolean>;
  cancelTwoFactor: () => void;
  /** Replaces the signed-in user's details (e.g. after switching two-factor on or off). */
  updateCurrentUser: (user: AdminUserSummary) => void;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(getStoredUser()));
  const [currentUser, setCurrentUser] = useState<AdminUserSummary | null>(() => getStoredUser());
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isRemembered, setIsRemembered] = useState(() => isAdminRemembered());

  // Between "password ok" and "code ok" we hold the server's challenge token,
  // and the remember choice, in memory only — never in storage.
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const challengeRef = useRef<{ token: string; remember: boolean } | null>(null);

  const completeSignIn = useCallback((user: AdminUserSummary, remember: boolean) => {
    setStoredUser(user);
    setIsAuthenticated(true);
    setCurrentUser(user);
    setIsRemembered(remember);
    setNeedsTwoFactor(false);
    challengeRef.current = null;
  }, []);

  // The stored user only says "someone signed in here once". If the session has
  // since ended (browser closed without "keep me signed in", token expired, the
  // account was deactivated) we must find out now, not on the first failed click.
  useEffect(() => {
    if (!getStoredUser()) return;
    let cancelled = false;
    fetchAdminSession()
      .then((user) => {
        if (cancelled) return;
        if (user) {
          setStoredUser(user);
          setCurrentUser(user);
        } else {
          clearStoredUser();
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      })
      .catch(() => {
        // Couldn't reach the server (offline, waking up): keep the last known state.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string, remember: boolean) => {
      setIsLoggingIn(true);
      setLoginError(null);
      try {
        const result = await adminLogin(email, password, remember);
        if ("requiresTwoFactor" in result) {
          challengeRef.current = { token: result.challenge, remember };
          setNeedsTwoFactor(true);
          return false;
        }
        completeSignIn(result.user, remember);
        return true;
      } catch (err) {
        setLoginError(err instanceof ApiError ? err.message : "Login failed. Please try again.");
        return false;
      } finally {
        setIsLoggingIn(false);
      }
    },
    [completeSignIn]
  );

  const submitTwoFactor = useCallback(
    async (code: string) => {
      const challenge = challengeRef.current;
      if (!challenge) return false;
      setIsLoggingIn(true);
      setLoginError(null);
      try {
        const { user } = await adminLoginTwoFactor(challenge.token, code, challenge.remember);
        completeSignIn(user, challenge.remember);
        return true;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Login failed. Please try again.";
        setLoginError(message);
        // The challenge only lasts five minutes; if it lapsed, go back to the password step.
        if (err instanceof ApiError && /took too long/i.test(message)) {
          setNeedsTwoFactor(false);
          challengeRef.current = null;
        }
        return false;
      } finally {
        setIsLoggingIn(false);
      }
    },
    [completeSignIn]
  );

  const cancelTwoFactor = useCallback(() => {
    setNeedsTwoFactor(false);
    setLoginError(null);
    challengeRef.current = null;
  }, []);

  const updateCurrentUser = useCallback((user: AdminUserSummary) => {
    setStoredUser(user);
    setCurrentUser(user);
  }, []);

  const logout = useCallback(() => {
    clearAdminToken();
    clearStoredUser();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setIsRemembered(false);
  }, []);

  return (
    <AdminAuthContext.Provider
      value={{
        isAuthenticated,
        currentUser,
        isLoggingIn,
        loginError,
        needsTwoFactor,
        isRemembered,
        login,
        submitTwoFactor,
        cancelTwoFactor,
        updateCurrentUser,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider.");
  }
  return context;
}
