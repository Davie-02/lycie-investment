import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import {
  adminLogin,
  clearAdminToken,
  getStoredUser,
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
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(getStoredUser()));
  const [currentUser, setCurrentUser] = useState<AdminUserSummary | null>(() => getStoredUser());
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const { user } = await adminLogin(email, password);
      setStoredUser(user);
      setIsAuthenticated(true);
      setCurrentUser(user);
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Login failed. Please try again.";
      setLoginError(message);
      return false;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearAdminToken();
    clearStoredUser();
    setIsAuthenticated(false);
    setCurrentUser(null);
  }, []);

  return (
    <AdminAuthContext.Provider
      value={{ isAuthenticated, currentUser, isLoggingIn, loginError, login, logout }}
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
