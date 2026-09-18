import { randomBytes, timingSafeEqual } from "crypto";
import type { Request, Response } from "express";
import { readCookie } from "./cookies";

export const CSRF_COOKIE = "lycie_csrf";
export const CSRF_HEADER = "x-csrf-token";

export function createCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

export function setCsrfCookie(response: Response, token: string): void {
  response.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 2 * 60 * 60 * 1000,
    path: "/",
  });
}

export function hasValidCsrfToken(request: Request): boolean {
  const cookieToken = readCookie(request.headers.cookie, CSRF_COOKIE);
  const header = request.headers[CSRF_HEADER];
  const headerToken = Array.isArray(header) ? header[0] : header;

  if (!cookieToken || typeof headerToken !== "string") return false;
  if (cookieToken.length !== headerToken.length) return false;

  return timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
}