import { test, expect } from "@playwright/test";
import { TEST_CUSTOMER_PASSWORD, uniqueCustomerEmail } from "./constants";

test.describe("Customer authentication", () => {
  test("register, session persists across refresh, logout blocks the account page", async ({ page }) => {
    const email = uniqueCustomerEmail();

    await page.goto("/account/register");
    await page.getByLabel("Full Name").fill("E2E Test Customer");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(TEST_CUSTOMER_PASSWORD);
    await page.getByRole("button", { name: "Create Account" }).click();

    await expect(page.getByRole("heading", { name: "My account" })).toBeVisible();

    // Session persists across a hard refresh (cookie-based, not in-memory only).
    await page.reload();
    await expect(page.getByRole("heading", { name: "My account" })).toBeVisible();

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    // /account is only reachable while authenticated — after logout it
    // renders the login form instead (see AppRoutes' CustomerAccountRoute).
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("rejects an unknown account with a generic error", async ({ page }) => {
    await page.goto("/account/login");
    await page.getByLabel("Email").fill(`nobody-${Date.now()}@example.com`);
    await page.getByLabel("Password").fill("whatever-password");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.getByRole("alert")).toContainText(/invalid/i);
    await expect(page.getByRole("heading", { name: "My account" })).not.toBeVisible();
  });
});
