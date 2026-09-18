// Fixed credentials for the E2E test admin account, seeded fresh into the
// isolated lycie_investment_test database on every test run (see
// playwright.config.ts). Not a real secret — this account only ever exists
// in a throwaway local/CI test database, never in production.
export const TEST_ADMIN_EMAIL = "e2e-admin@example.com";
export const TEST_ADMIN_PASSWORD = "Test-Passw0rd!";
export const TEST_ADMIN_PASSWORD_HASH =
  "$2a$10$tmbTfk0L8PBvKdym1B3qwObhcMNjc/lSGGNmZmo3ZHiNjVOgQZR2O";

// Each test run gets a unique customer to avoid colliding with a previous
// run against the same (non-reset-between-tests) dev server instance.
export function uniqueCustomerEmail(): string {
  return `e2e-customer-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
}

export const TEST_CUSTOMER_PASSWORD = "Test-Passw0rd!";
