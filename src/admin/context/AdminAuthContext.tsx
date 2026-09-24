/**
 * Who is signed in to the staff workspace, and what they can use.
 *
 * Sign-in steps (portal or website): password → [choose your own password,
 * for invited staff] → [authenticator code, if two-step is on] → signed in.
 * `can(module, level)` answers "may this person see/change this module?" from
 * the access map the server sends (department defaults + overrides). The
 * server enforces the same rules; this only decides what to show.
 */
import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  adminFirstPassword,
  adminLogin,
  adminLoginTwoFactor,
  clearAdminToken,
  fetchAdminSession,
  getStoredUser,
  isAdminRemembered,
  setStoredUser,
  clearStoredUser,
  type AdminLoginResult,
  type AdminUserSummary,
} from "../adminApi";
import { ApiError } from "@/services/http";
import { atLeast, type Level, type ModuleKey } from "../access";

interface AdminAuthContextValue {
  isAuthenticated: boolean;
  currentUser: AdminUserSummary | null;
  /** The system administrator (Owner): everything, always. */
  isSystemAdmin: boolean;
  isLoggingIn: boolean;
  loginError: string | null;
  /** True once the password was accepted but an authenticator code is still needed. */
  needsTwoFactor: boolean;
  /** True when an invited person must choose their own password (name shown in the greeting). */
  needsPasswordChange: { name: string } | null;
  /** "Keep me signed in" was chosen for this session (the 5-minute idle logout is skipped). */
  isRemembered: boolean;
  /** Returns true only when fully signed in. */
  login: (email: string, password: string, remember: boolean) => Promise<boolean>;
  submitTwoFactor: (code: string) => Promise<boolean>;
  submitFirstPassword: (newPassword: string) => Promise<boolean>;
  cancelTwoFactor: () => void;
  /** May this person use `module` at `level` (default "view")? */
  can: (module: ModuleKey, level?: Level) => boolean;
  /** Replaces the signed-in user's details (e.g. after switching two-factor on or off). */
  updateCurrentUser: (user: AdminUserSummary) => void;
  /** Re-reads the account from the server (after an access change). */
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(getStoredUser()));
  const [currentUser, setCurrentUser] = useState<AdminUserSummary | null>(() => getStoredUser());
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isRemembered, setIsRemembered] = useState(() => isAdminRemembered());

  // Between steps we hold the server's short-lived challenge token, and the
  // remember choice, in memory only — never in storage.
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [needsPasswordChange, setNeedsPasswordChange] = useState<{ name: string } | null>(null);
  const challengeRef = useRef<{ token: string; remember: boolean } | null>(null);

  const completeSignIn = useCallback((user: AdminUserSummary, remember: boolean) => {
    setStoredUser(user);
    setIsAuthenticated(true);
    setCurrentUser(user);
    setIsRemembered(remember);
    setNeedsTwoFactor(false);
    setNeedsPasswordChange(null);
    challengeRef.current = null;
  }, []);

  /** Moves to whichever step the server asked for next. True = fully signed in. */
  const handleStep = useCallback(
    (result: AdminLoginResult, remember: boolean) => {
      if ("requiresPasswordChange" in result) {
        challengeRef.current = { token: result.challenge, remember };
        setNeedsPasswordChange({ name: result.name });
        setNeedsTwoFactor(false);
        return false;
      }
      if ("requiresTwoFactor" in result) {
        challengeRef.current = { token: result.challenge, remember };
        setNeedsPasswordChange(null);
        setNeedsTwoFactor(true);
        return false;
      }
      completeSignIn(result.user, remember);
      return true;
    },
    [completeSignIn]
  );

  const refreshUser = useCallback(async () => {
    const user = await fetchAdminSession();
    if (user) {
      setStoredUser(user);
      setCurrentUser(user);
    } else {
      clearStoredUser();
      setIsAuthenticated(false);
      setCurrentUser(null);
    }
  }, []);

  // The stored user only says "someone signed in here once". If the session has
  // since ended we must find out now; and the access map may have changed.
  useEffect(() => {
    if (!getStoredUser()) return;
    refreshUser().catch(() => {
      // Couldn't reach the server (offline, waking up): keep the last known state.
    });
  }, [refreshUser]);

  const run = useCallback(async (work: () => Promise<boolean>) => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      return await work();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Sign-in failed. Please try again.";
      setLoginError(message);
      // Challenges are short-lived; if one lapsed, go back to the password step.
      if (err instanceof ApiError && /took too long|sign in again/i.test(message)) {
        setNeedsTwoFactor(false);
        setNeedsPasswordChange(null);
        challengeRef.current = null;
      }
      return false;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const login = useCallback(
    (email: string, password: string, remember: boolean) => run(async () => handleStep(await adminLogin(email, password, remember), remember)),
    [run, handleStep]
  );

  const submitTwoFactor = useCallback(
    (code: string) =>
      run(async () => {
        const challenge = challengeRef.current;
        if (!challenge) return false;
        const { user } = await adminLoginTwoFactor(challenge.token, code, challenge.remember);
        completeSignIn(user, challenge.remember);
        return true;
      }),
    [run, completeSignIn]
  );

  const submitFirstPassword = useCallback(
    (newPassword: string) =>
      run(async () => {
        const challenge = challengeRef.current;
        if (!challenge) return false;
        return handleStep(await adminFirstPassword(challenge.token, newPassword, challenge.remember), challenge.remember);
      }),
    [run, handleStep]
  );

  const cancelTwoFactor = useCallback(() => {
    setNeedsTwoFactor(false);
    setNeedsPasswordChange(null);
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

  const isSystemAdmin = currentUser?.role === "OWNER";
  const can = useCallback(
    (module: ModuleKey, level: Level = "view") => {
      if (!currentUser) return false;
      if (currentUser.role === "OWNER") return true;
      return atLeast(currentUser.access?.[module], level);
    },
    [currentUser]
  );

  return (
    <AdminAuthContext.Provider
      value={{
        isAuthenticated,
        currentUser,
        isSystemAdmin,
        isLoggingIn,
        loginError,
        needsTwoFactor,
        needsPasswordChange,
        isRemembered,
        login,
        submitTwoFactor,
        submitFirstPassword,
        cancelTwoFactor,
        can,
        updateCurrentUser,
        refreshUser,
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
